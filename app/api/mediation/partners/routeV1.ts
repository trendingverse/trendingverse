// app/api/mediation/partners/route.ts
// ══════════════════════════════════════════════════════════════════
// Management API for demand partners (ad networks) + their placements
// (per-site/position/size tags). Admin-gated. Drives the serve-slot
// engine that already reads these tables.
//
// GET                      -> { partners:[...], placements:[...] }
// POST { action:'partner', ... }        -> create/update a partner
// POST { action:'placement', ... }      -> create/update a placement
// POST { action:'delete_partner', id }  -> delete a partner (+ its placements)
// POST { action:'delete_placement', id }-> delete a placement
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

function svc() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user && user.email === ADMIN_EMAIL ? user : null
}
function slugify(s: string) {
  return (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = svc()
  const [{ data: partners }, { data: placements }] = await Promise.all([
    admin.from('demand_partners').select('*').order('waterfall_order', { ascending: true }),
    admin.from('demand_partner_placements').select('*').order('waterfall_order', { ascending: true }),
  ])
  return NextResponse.json({ partners: partners || [], placements: placements || [] })
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = svc()
  const body = await req.json().catch(() => ({}))
  const action = body.action

  // ── PARTNER (ad network) create/update ──
  if (action === 'partner') {
    const row: any = {
  name: body.name,
  slug: body.slug ? slugify(body.slug) : slugify(body.name),
  ad_code_template: body.ad_code_template || null,
  waterfall_order: parseInt(body.waterfall_order, 10) || 100,
  is_active: body.is_active !== false,
}
// Save reporting API config if provided
if (body.report_adapter || body.report_api_key) {
  row.config = {
    report: {
      adapter: body.report_adapter || null,
      api_key: body.report_api_key || null,
    }
  }
}
    if (body.id) {
      const { data, error } = await admin.from('demand_partners').update(row).eq('id', body.id).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }
    const { data, error } = await admin.from('demand_partners').insert(row).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // ── PLACEMENT (per-site/position/size tag) create/update ──
  if (action === 'placement') {
    if (!body.partner_id) return NextResponse.json({ error: 'partner_id required' }, { status: 400 })
    const row: any = {
      partner_id: body.partner_id,
      site_url: (body.site_url || '').trim() || null,
      position: body.position || null,
      size_width: body.size_width ? parseInt(body.size_width, 10) : null,
      size_height: body.size_height ? parseInt(body.size_height, 10) : null,
      ad_code: body.ad_code || null,
      waterfall_order: body.waterfall_order !== undefined && body.waterfall_order !== ''
        ? parseInt(body.waterfall_order, 10) : null,
      is_active: body.is_active !== false,
    }
    if (body.id) {
      const { data, error } = await admin.from('demand_partner_placements').update(row).eq('id', body.id).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }
    // upsert on the unique key to avoid duplicate-placement errors
    const { data, error } = await admin.from('demand_partner_placements')
      .upsert(row, { onConflict: 'partner_id,site_url,position,size_width,size_height' })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (action === 'delete_partner' && body.id) {
    const { error } = await admin.from('demand_partners').delete().eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'delete_placement' && body.id) {
    const { error } = await admin.from('demand_partner_placements').delete().eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
