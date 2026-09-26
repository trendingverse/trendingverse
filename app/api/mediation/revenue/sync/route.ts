// app/api/mediation/revenue/sync/route.ts
// ══════════════════════════════════════════════════════════════════
// Pulls revenue from every partner that has report config, via its
// adapter, and upserts into partner_revenue. Used by the manual
// "Sync now" button AND callable from the daily cron.
//
// v2 fixes:
//  • Partners report several rows per site per day (one per placement).
//    Previously each row overwrote the last (only the final placement
//    survived). Rows are now SUMMED per site + day before saving.
//  • revenue_usd and revenue_inr are now both correct, converted with
//    the currency_rates table (fallback 83.5 INR per USD).
//
// POST { start?, end? }  (defaults: last 7 days)
// Admin-gated for manual calls; cron calls it with the CRON secret.
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getAdapter } from '@/lib/revenue-adapters'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
const FALLBACK_USD_INR = 83.5

function svc() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// USD→INR rate for a given date, from currency_rates (either direction stored)
async function loadFx(admin: any) {
  const { data } = await admin
    .from('currency_rates')
    .select('base_currency,target_currency,rate,rate_date')
    .or('and(base_currency.eq.USD,target_currency.eq.INR),and(base_currency.eq.INR,target_currency.eq.USD)')
    .order('rate_date', { ascending: true })
    .limit(5000)
  const points: { d: string; r: number }[] = []
  for (const x of data || []) {
    const rate = Number(x.rate)
    if (!rate) continue
    const usdInr = x.base_currency === 'USD' ? rate : 1 / rate
    if (usdInr > 10 && usdInr < 1000) points.push({ d: String(x.rate_date), r: usdInr })
  }
  return (date: string): number => {
    if (!points.length) return FALLBACK_USD_INR
    let best = points[0].r
    for (const p of points) {
      if (p.d <= date) best = p.r
      else break
    }
    return best
  }
}

async function runSync(start: string, end: string) {
  const admin = svc()
  const fx = await loadFx(admin)
  const { data: partners } = await admin.from('demand_partners').select('*').eq('is_active', true)
  const results: any[] = []

  for (const p of partners || []) {
    const reportCfg = p.config?.report
    if (!reportCfg || !reportCfg.adapter) continue // no reporting configured — skip quietly

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

    // ── Sum all rows per site + day (placements, countries, etc.) ──
    const agg = new Map<string, any>()
    for (const row of res.rows || []) {
      if (!row?.date) continue
      const site = String(row.site || '(all)').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
      const date = String(row.date).slice(0, 10)
      const key = `${site}|${date}`
      if (!agg.has(key)) {
        agg.set(key, { site, date, impressions: 0, clicks: 0, revenue: 0, currency: String(row.currency || 'USD').toUpperCase(), parts: [] as any[] })
      }
      const a = agg.get(key)
      a.impressions += Number(row.impressions) || 0
      a.clicks += Number(row.clicks) || 0
      a.revenue += Number(row.revenue) || 0
      if (a.parts.length < 200) a.parts.push(row.raw ?? row)
    }

    const upserts = Array.from(agg.values()).map(a => {
      const rate = fx(a.date)
      const isInr = a.currency === 'INR'
      const usd = isInr ? a.revenue / rate : a.revenue
      const inr = isInr ? a.revenue : a.revenue * rate
      return {
        partner_id: p.id,
        partner_slug: p.slug,
        site_url: a.site,
        revenue_date: a.date,
        impressions: Math.round(a.impressions),
        clicks: Math.round(a.clicks),
        revenue_usd: +usd.toFixed(6),
        revenue_inr: +inr.toFixed(4),
        currency: a.currency,
        raw: { usd_inr_rate: rate, rows: a.parts },
        synced_at: new Date().toISOString(),
      }
    })

    let ingested = 0
    let lastError = ''
    for (let i = 0; i < upserts.length; i += 200) {
      const batch = upserts.slice(i, i + 200)
      const { error } = await admin.from('partner_revenue').upsert(batch, { onConflict: 'partner_id,site_url,revenue_date' })
      if (error) lastError = error.message
      else ingested += batch.length
    }

    await admin.from('partner_revenue_sync_log').insert({
      partner_slug: p.slug,
      status: lastError ? 'partial' : 'success',
      rows_ingested: ingested,
      error: lastError || null,
    })
    results.push({ partner: p.slug, ok: !lastError, rows: ingested, source_rows: (res.rows || []).length, error: lastError || undefined })
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
