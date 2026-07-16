// app/api/mediation/partners/route.ts  — v2 (saves report API config on partner)
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
  // Mask api keys before sending to client (show only whether one is set)
  const safePartners = (partners || []).map((p: any) => {
    const hasKey = !!(p.config?.report?.api_key)
    const adapter = p.config?.report?.adapter || null
    return { ...p, _has_report_key: hasKey, _report_adapter: adapter, config: undefined }
  })
  return NextResponse.json({ partners: safePartners, placements: placements || [] })
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = svc()
  const body = await req.json().catch(() => ({}))
  const action = body.action

  if (action === 'partner') {
    const row: any = {
      name: body.name,
      slug: body.slug ? slugify(body.slug) : slugify(body.name),
      ad_code_template: body.ad_code_template || null,
      waterfall_order: parseInt(body.waterfall_order, 10) || 100,
      is_active: body.is_active !== false,
    }
    // Report API config. Only overwrite the key if a new one was actually
    // provided (so editing other fields doesn't wipe the saved key).
    if (body.report_adapter !== undefined || body.report_api_key !== undefined) {
      // fetch existing to preserve key if not re-entered
      let existingKey: string | null = null
      if (body.id) {
        const { data: cur } = await admin.from('demand_partners').select('config').eq('id', body.id).single()
        existingKey = cur?.config?.report?.api_key || null
      }
      row.config = {
        report: {
          adapter: body.report_adapter || null,
          api_key: (body.report_api_key && body.report_api_key.trim()) ? body.report_api_key.trim() : existingKey,
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
    const { data, error } = await admin.from('demand_partner_placements')
      .upsert(row, { onConflict: 'partner_id,site_url,position,size_width,size_height' }).select().single()
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
