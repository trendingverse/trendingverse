// app/api/admin/ads-txt/route.ts
// Admin CRUD for per-publisher ads.txt entries.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

function admin() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === ADMIN_EMAIL ? user : null
}

// GET ?site_id=... — list entries for a site (or all if omitted)
export async function GET(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const siteId = searchParams.get('site_id')
  let q = admin().from('ads_txt_entries').select('*').order('created_at', { ascending: true })
  if (siteId) q = q.eq('site_id', siteId)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// POST — create an entry
export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const b = await req.json()
  if (!b.site_id || !b.ad_system || !b.publisher_id) {
    return NextResponse.json({ error: 'site_id, ad_system, publisher_id required' }, { status: 400 })
  }
  const { data, error } = await admin().from('ads_txt_entries').insert({
    site_id: b.site_id,
    site_url: b.site_url || null,
    ad_system: b.ad_system.trim(),
    publisher_id: b.publisher_id.trim(),
    relationship: (b.relationship || 'DIRECT').toUpperCase(),
    cert_authority_id: b.cert_authority_id?.trim() || null,
    notes: b.notes || null,
    is_active: b.is_active !== false,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH — update an entry (toggle active, edit fields)
export async function PATCH(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const b = await req.json()
  if (!b.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { id, ...updates } = b
  updates.updated_at = new Date().toISOString()
  const { error } = await admin().from('ads_txt_entries').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ── ads.txt line parser ──────────────────────────────────────────
// Turns a raw pasted ads.txt block into structured seller entries +
// variable declarations. Handles comments, blank lines, variables,
// and inconsistent spacing/casing.
function parseAdsTxt(raw: string): {
  entries: { ad_system: string; publisher_id: string; relationship: string; cert_authority_id: string | null }[]
  variables: string[]
} {
  const entries: any[] = []
  const variables: string[] = []
  const VARIABLE_KEYS = ['CONTACT', 'SUBDOMAIN', 'OWNERDOMAIN', 'MANAGERDOMAIN', 'INVENTORYPARTNERDOMAIN']

  for (const rawLine of raw.split(/\r?\n/)) {
    // Strip inline comments and trim
    const line = rawLine.split('#')[0].trim()
    if (!line) continue

    // Variable declaration? (KEY=value)
    const eqIdx = line.indexOf('=')
    if (eqIdx > 0 && VARIABLE_KEYS.includes(line.slice(0, eqIdx).trim().toUpperCase())) {
      variables.push(line.trim())
      continue
    }

    // Seller line: domain, pubid, relationship[, certid]
    const parts = line.split(',').map(p => p.trim()).filter(Boolean)
    if (parts.length < 2) continue // not a valid seller line

    const ad_system = parts[0].toLowerCase()
    const publisher_id = parts[1]
    let relationship = (parts[2] || 'DIRECT').toUpperCase()
    if (relationship !== 'DIRECT' && relationship !== 'RESELLER') relationship = 'DIRECT'
    const cert_authority_id = parts[3] || null

    entries.push({ ad_system, publisher_id, relationship, cert_authority_id })
  }

  return { entries, variables }
}

// PUT — bulk paste for a site: parse a raw block, append (dedupe), and
// merge any variable declarations into the site's ads_txt_variables.
export async function PUT(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const b = await req.json()
  if (!b.site_id || typeof b.raw !== 'string') {
    return NextResponse.json({ error: 'site_id and raw (text block) required' }, { status: 400 })
  }

  const { entries, variables } = parseAdsTxt(b.raw)
  if (!entries.length && !variables.length) {
    return NextResponse.json({ error: 'No valid ads.txt lines found in the pasted block' }, { status: 400 })
  }

  const db = admin()

  // Existing entries for dedupe (append mode — keep existing, skip dupes)
  const { data: existing } = await db
    .from('ads_txt_entries')
    .select('ad_system, publisher_id, relationship')
    .eq('site_id', b.site_id)

  const existingSigs = new Set(
    (existing || []).map((e: any) => `${e.ad_system}|${e.publisher_id}|${e.relationship}`.toLowerCase())
  )

  const toInsert = entries
    .filter(e => {
      const sig = `${e.ad_system}|${e.publisher_id}|${e.relationship}`.toLowerCase()
      if (existingSigs.has(sig)) return false
      existingSigs.add(sig) // also dedupe within the pasted block itself
      return true
    })
    .map(e => ({ ...e, site_id: b.site_id, site_url: b.site_url || null, is_active: true }))

  let inserted = 0
  if (toInsert.length) {
    const { error } = await db.from('ads_txt_entries').insert(toInsert)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    inserted = toInsert.length
  }

  // Merge variable declarations into the site's ads_txt_variables (dedupe by key)
  let variablesUpdated = false
  if (variables.length) {
    const { data: siteRow } = await db.from('sites').select('ads_txt_variables').eq('id', b.site_id).single()
    const existingVars = (siteRow?.ads_txt_variables || '').split(/\r?\n/).map((v: string) => v.trim()).filter(Boolean)
    const varKey = (v: string) => v.split('=')[0].trim().toUpperCase()
    const existingKeys = new Set(existingVars.map(varKey))
    const newVars = variables.filter(v => !existingKeys.has(varKey(v)))
    if (newVars.length) {
      const merged = [...existingVars, ...newVars].join('\n')
      await db.from('sites').update({ ads_txt_variables: merged }).eq('id', b.site_id)
      variablesUpdated = true
    }
  }

  return NextResponse.json({
    success: true,
    parsed: entries.length,
    inserted,
    skipped_duplicates: entries.length - inserted,
    variables_found: variables.length,
    variables_updated: variablesUpdated,
  })
}

// DELETE ?id=...
export async function DELETE(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await admin().from('ads_txt_entries').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
