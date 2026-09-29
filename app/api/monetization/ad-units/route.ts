// app/api/monetization/ad-units/route.ts  — v2
// Ad unit CRUD for the Monetization → Ad Units screen.
// v2: saves site, network and device; validates; warns on duplicate zones;
//     PATCH for edits; admin-only reads (codes are never exposed to publishers);
//     refuses to delete a unit that is still assigned to a publisher.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
const POSITIONS = ['header', 'in_content', 'footer', 'sidebar', 'popunder', 'sticky', 'interstitial']
const DEVICES = ['all', 'mobile', 'desktop']

async function adminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user: user && user.email === ADMIN_EMAIL ? user : null }
}

const normSite = (s: any) => {
  const v = String(s || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase()
  return v ? `https://${v}` : null
}
const normCode = (s: any) => String(s || '').replace(/\s+/g, ' ').trim()

// Validate + normalise a unit payload. `partial` = PATCH (only provided fields).
function clean(body: any, partial = false): { row?: any; error?: string } {
  const row: any = {}
  const has = (k: string) => body[k] !== undefined

  if (!partial || has('name')) {
    const name = String(body.name || '').trim()
    if (!name) return { error: 'Name is required' }
    row.name = name.slice(0, 120)
  }
  if (!partial || has('position')) {
    if (!POSITIONS.includes(body.position)) return { error: 'Choose a valid position' }
    row.position = body.position
  }
  if (!partial || has('size_width') || has('size_height')) {
    const w = parseInt(body.size_width, 10), h = parseInt(body.size_height, 10)
    if (!w || !h) return { error: 'Choose a size' }
    row.size_width = w
    row.size_height = h
  }
  if (!partial || has('ad_code')) {
    const code = String(body.ad_code || '').trim()
    if (!code) return { error: 'Ad code is required' }
    row.ad_code = code
  }
  if (!partial || has('site_url')) {
    row.site_url = normSite(body.site_url) // required by the new form; optional for the old one
  }
  if (!partial || has('network_name')) {
    row.network_name = String(body.network_name || '').trim().toLowerCase() || null
  }
  if (!partial || has('ad_type')) {
    row.ad_type = String(body.ad_type || (row.network_name === 'direct' ? 'direct' : 'network'))
  }
  if (!partial || has('device')) {
    let device = DEVICES.includes(body.device) ? body.device : ''
    const w = row.size_width ?? parseInt(body.size_width, 10) ?? 0
    if (!device) device = w >= 468 ? 'desktop' : 'all' // wide units don't fit phones
    row.device = device
  }
  if (has('gam_network_code')) row.gam_network_code = body.gam_network_code || null
  if (has('gam_unit_path')) row.gam_unit_path = body.gam_unit_path || null
  if (has('is_active')) row.is_active = !!body.is_active
  return { row }
}

// Non-blocking warnings shown after save
async function warningsFor(supabase: any, row: any, selfId?: string): Promise<string[]> {
  const out: string[] = []
  if (!row.site_url) out.push('No site set — the unit will only serve where it is assigned, and its revenue cannot be attributed to a site.')
  if (!row.network_name) out.push('No network set — reports will show it as unknown.')
  if (row.device === 'mobile' && row.size_width >= 468) out.push(`${row.size_width}x${row.size_height} is too wide for phones but is set to Mobile only.`)
  if (row.position === 'footer' && row.size_height > 100) out.push('Footer units taller than 100px show at the article end, not as the sticky bar.')
  if (row.ad_code) {
    const { data } = await supabase.from('ad_units').select('id,name,ad_code')
    const mine = normCode(row.ad_code)
    const dup = (data || []).find((u: any) => u.id !== selfId && normCode(u.ad_code) === mine)
    if (dup) out.push(`Same ad code is already used in "${dup.name}". A zone can only fill once per page — use a separate zone.`)
  }
  return out
}

export async function GET() {
  const { supabase, user } = await adminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data, error } = await supabase.from('ad_units').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await adminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { row, error: vErr } = clean(body)
  if (vErr) return NextResponse.json({ error: vErr }, { status: 400 })

  const { data, error } = await supabase.from('ad_units').insert({
    ...row,
    is_active: body.is_active === undefined ? true : !!body.is_active,
    created_by: user.id,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const warnings = await warningsFor(supabase, data, data.id)
  return NextResponse.json({ ...data, warnings }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { supabase, user } = await adminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  const { row, error: vErr } = clean(body, true)
  if (vErr) return NextResponse.json({ error: vErr }, { status: 400 })

  const { data, error } = await supabase.from('ad_units').update(row).eq('id', body.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const warnings = await warningsFor(supabase, data, data.id)
  return NextResponse.json({ ...data, warnings })
}

export async function DELETE(req: NextRequest) {
  const { supabase, user } = await adminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { count } = await supabase.from('publisher_ads').select('id', { count: 'exact', head: true }).eq('ad_unit_id', id)
  if (count && count > 0) {
    return NextResponse.json({ error: `This unit is assigned to ${count} publisher slot(s). Remove those assignments first.` }, { status: 409 })
  }
  const { error } = await supabase.from('ad_units').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
