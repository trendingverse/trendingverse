// app/api/mediation/revenue/sync/route.ts
// ══════════════════════════════════════════════════════════════════
// Pulls revenue from every partner that has report config, via its
// adapter, and upserts into partner_revenue. Used by the manual
// "Sync now" button AND callable from the daily cron.
//
// POST { start?, end? }  (defaults: last 7 days)
// Admin-gated for manual calls; cron calls it with the CRON secret.
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getAdapter } from '@/lib/revenue-adapters'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

function svc() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function runSync(start: string, end: string) {
  const admin = svc()
  const { data: partners } = await admin.from('demand_partners').select('*').eq('is_active', true)
  const results: any[] = []

  for (const p of partners || []) {
    const reportCfg = p.config?.report
    if (!reportCfg || !reportCfg.adapter) {
      // no reporting configured for this partner — skip quietly
      continue
    }
    const adapter = getAdapter(reportCfg.adapter)
    if (!adapter) {
      await admin.from('partner_revenue_sync_log').insert({
        partner_slug: p.slug, status: 'failed', error: `No adapter '${reportCfg.adapter}'`,
      })
      results.push({ partner: p.slug, ok: false, error: `No adapter '${reportCfg.adapter}'` })
      continue
    }
    const res = await adapter(reportCfg, start, end)
    if (!res.ok) {
      await admin.from('partner_revenue_sync_log').insert({
        partner_slug: p.slug, status: 'failed', error: res.error,
      })
      results.push({ partner: p.slug, ok: false, error: res.error })
      continue
    }
    // Upsert normalized rows
    let ingested = 0
    for (const row of res.rows) {
      const site = (row.site || '(all)').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
      const { error } = await admin.from('partner_revenue').upsert({
        partner_id: p.id,
        partner_slug: p.slug,
        site_url: site,
        revenue_date: row.date,
        impressions: row.impressions,
        clicks: row.clicks,
        revenue_usd: row.revenue,
        revenue_inr: row.revenue, // TODO: FX convert if needed; for now store native
        currency: row.currency,
        raw: row.raw,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'partner_id,site_url,revenue_date' })
      if (!error) ingested++
    }
    await admin.from('partner_revenue_sync_log').insert({
      partner_slug: p.slug, status: 'success', rows_ingested: ingested,
    })
    results.push({ partner: p.slug, ok: true, rows: ingested })
  }
  return results
}

function isCronAuthed(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const q = new URL(req.url).searchParams.get('secret')
  const h = req.headers.get('authorization')?.replace('Bearer ', '')
  return q === secret || h === secret || req.headers.get('x-vercel-cron') === '1'
}

export async function POST(req: NextRequest) {
  // Allow either an admin session OR the cron secret
  let authed = isCronAuthed(req)
  if (!authed) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    authed = !!(user && user.email === ADMIN_EMAIL)
  }
  if (!authed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const end = body.end || new Date().toISOString().split('T')[0]
  const start = body.start || new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0]
  const results = await runSync(start, end)
  return NextResponse.json({ ok: true, start, end, results })
}

// GET for easy cron pinging (?secret=...)
export async function GET(req: NextRequest) {
  if (!isCronAuthed(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const end = new Date().toISOString().split('T')[0]
  const start = new Date(Date.now() - 3 * 864e5).toISOString().split('T')[0] // last 3 days on cron
  const results = await runSync(start, end)
  return NextResponse.json({ ok: true, start, end, results })
}
