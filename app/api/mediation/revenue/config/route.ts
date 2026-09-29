// app/api/mediation/revenue/config/route.ts
// ══════════════════════════════════════════════════════════════════
// Reporting-API settings per network (demand_partners.config.report).
//  GET  → every network with its report settings (API key never returned),
//         whether a key is saved, and the last sync result.
//  POST { action: 'save', partner_id, report }  → save (blank key keeps the old one)
//  POST { action: 'test', partner_id, report }  → live pull of the last 3 days,
//         nothing saved; returns row count + preview or the error.
// Admin only. Only config.report is touched — other partner settings stay as they are.
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getAdapter } from '@/lib/revenue-adapters'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

function svc() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
async function isAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return !!user && user.email === ADMIN_EMAIL
}

const FIELDS = ['adapter', 'endpoint', 'date_format', 'auth_type', 'auth_name', 'site_fallback', 'currency', 'rows_path'] as const

// Keep only known fields, trimmed; api_key handled separately
function cleanReport(input: any, existing: any) {
  const out: any = {}
  for (const f of FIELDS) {
    const v = String(input?.[f] ?? '').trim()
    if (v) out[f] = v
  }
  if (!out.adapter) out.adapter = 'generic'
  const newKey = String(input?.api_key ?? '').trim()
  const oldKey = existing?.api_key || ''
  out.api_key = newKey || oldKey
  return out
}

function validate(r: any): string | null {
  if (!['generic', 'adsterra'].includes(r.adapter)) return 'Unknown adapter'
  if (!r.api_key) return 'Enter the API key'
  if (r.adapter === 'generic') {
    if (!/^https?:\/\//i.test(r.endpoint || '')) return 'Enter the full stats URL (starting with https://)'
    if (/NETWORK-STATS-URL/i.test(r.endpoint)) return 'Replace the example URL with the network’s real stats URL'
    if (!r.auth_name) return 'Enter the key parameter / header name (e.g. key)'
    if (!['query', 'header'].includes(r.auth_type || 'query')) return 'Choose where the key goes'
  }
  return null
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = svc()
  const [{ data: partners }, { data: logs }] = await Promise.all([
    admin.from('demand_partners').select('id,name,slug,is_active,config').order('name'),
    admin.from('partner_revenue_sync_log').select('partner_slug,status,rows_ingested,error,ran_at').order('ran_at', { ascending: false }).limit(200),
  ])
  const lastBySlug: Record<string, any> = {}
  for (const l of logs || []) if (!lastBySlug[l.partner_slug]) lastBySlug[l.partner_slug] = l

  return NextResponse.json({
    partners: (partners || []).map((p: any) => {
      const rep = p.config?.report || null
      const safe = rep ? Object.fromEntries(Object.entries(rep).filter(([k]) => k !== 'api_key')) : null
      return {
        id: p.id, name: p.name, slug: p.slug, is_active: p.is_active,
        report: safe,
        has_key: !!rep?.api_key,
        placeholder: !!rep && /NETWORK-STATS-URL|PASTE_TOKEN/i.test(JSON.stringify(rep)),
        last_sync: lastBySlug[p.slug] || null,
      }
    }),
  })
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = svc()
  const body = await req.json().catch(() => ({}))
  const { action, partner_id } = body
  if (!partner_id) return NextResponse.json({ error: 'partner_id missing' }, { status: 400 })

  const { data: partner, error: pErr } = await admin.from('demand_partners').select('id,slug,config').eq('id', partner_id).single()
  if (pErr || !partner) return NextResponse.json({ error: 'Network not found' }, { status: 404 })

  if (action === 'disable') {
    const config = { ...(partner.config || {}) }
    delete config.report
    const { error } = await admin.from('demand_partners').update({ config }).eq('id', partner_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const existing = partner.config?.report || {}
  const report = cleanReport(body.report, existing)
  const problem = validate(report)
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })

  if (action === 'test') {
    const adapter = getAdapter(report.adapter)
    if (!adapter) return NextResponse.json({ error: `No adapter '${report.adapter}'` }, { status: 400 })
    const end = new Date().toISOString().slice(0, 10)
    const start = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10)
    const res = await adapter(report, start, end)
    if (!res.ok) return NextResponse.json({ ok: false, error: res.error, range: { start, end } })
    const rows = res.rows || []
    return NextResponse.json({
      ok: true,
      range: { start, end },
      rows: rows.length,
      sites: Array.from(new Set(rows.map(r => r.site))).slice(0, 10),
      preview: rows.slice(0, 5).map(r => ({ date: r.date, site: r.site, impressions: r.impressions, clicks: r.clicks, revenue: r.revenue, currency: r.currency })),
    })
  }

  if (action === 'save') {
    const config = { ...(partner.config || {}), report }
    const { error } = await admin.from('demand_partners').update({ config }).eq('id', partner_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
