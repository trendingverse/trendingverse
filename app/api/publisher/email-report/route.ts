export const runtime = 'edge'
// app/api/publisher/email-report/route.ts
// POST — sends the publisher's earnings report to their own email address.
// Auth required; non-admins are always locked to their own data.
// Uses Resend (same key as welcome emails). Gracefully no-ops if key missing.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
const FROM_EMAIL  = process.env.FROM_EMAIL  || 'noreply@trendingverse.online'
const FALLBACK_USD_INR = 83.5
const DEFAULT_SHARE = 70

function inrFmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function usdFmt(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}
function pct(clicks: number, impressions: number) {
  if (!impressions) return '0.00%'
  return ((clicks / impressions) * 100).toFixed(2) + '%'
}

function buildHtml(opts: {
  publisherName: string
  publisherEmail: string
  start: string
  end: string
  total: { earnings_usd: number; earnings_inr: number; impressions: number; clicks: number }
  by_site: Array<{ key: string; earnings_usd: number; earnings_inr: number; impressions: number; clicks: number }>
  by_day:  Array<{ key: string; earnings_usd: number; earnings_inr: number; impressions: number; clicks: number }>
}) {
  const { publisherName, start, end, total, by_site, by_day } = opts

  const tableStyle = 'width:100%;border-collapse:collapse;font-size:13px;'
  const th = 'padding:8px 12px;text-align:left;background:#F3F4F6;color:#374151;font-weight:600;border:1px solid #E5E7EB;'
  const thR = th + 'text-align:right;'
  const td = 'padding:8px 12px;border:1px solid #E5E7EB;color:#111827;vertical-align:top;'
  const tdR = td + 'text-align:right;font-variant-numeric:tabular-nums;'
  const tdG = tdR + 'color:#047857;font-weight:600;'

  const siteRows = by_site.map(r => `
    <tr>
      <td style="${td}">${r.key}</td>
      <td style="${tdG}">${inrFmt(r.earnings_inr)}</td>
      <td style="${tdG}">${usdFmt(r.earnings_usd)}</td>
      <td style="${tdR}">${r.impressions.toLocaleString('en-IN')}</td>
      <td style="${tdR}">${r.clicks.toLocaleString('en-IN')}</td>
      <td style="${tdR}">${pct(r.clicks, r.impressions)}</td>
    </tr>`).join('')

  const dayRows = by_day.slice(-30).reverse().map(r => `
    <tr>
      <td style="${td}">${r.key}</td>
      <td style="${tdG}">${inrFmt(r.earnings_inr)}</td>
      <td style="${tdR}">${r.impressions.toLocaleString('en-IN')}</td>
      <td style="${tdR}">${r.clicks.toLocaleString('en-IN')}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Earnings Report</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

        <!-- Header -->
        <tr><td style="background:#111827;padding:28px 32px;text-align:center;">
          <h1 style="margin:0;font-size:26px;color:#fff;font-weight:800;letter-spacing:-0.5px;">
            Trending<span style="color:#EF4444;">Verse</span>
          </h1>
          <p style="margin:6px 0 0;color:#9CA3AF;font-size:13px;">Publisher Earnings Report</p>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:28px 32px 0;">
          <h2 style="margin:0 0 4px;font-size:20px;color:#111827;font-weight:700;">
            Hey ${publisherName} 👋
          </h2>
          <p style="margin:0;font-size:14px;color:#6B7280;">
            Here's your earnings summary for <strong>${start}</strong> to <strong>${end}</strong>.
          </p>
        </td></tr>

        <!-- KPI tiles -->
        <tr><td style="padding:20px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="48%" style="background:linear-gradient(135deg,#065F46,#059669);border-radius:12px;padding:20px;text-align:center;">
                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.8px;">Your Earnings (INR)</p>
                <p style="margin:6px 0 0;font-size:28px;font-weight:800;color:#fff;">${inrFmt(total.earnings_inr)}</p>
              </td>
              <td width="4%"></td>
              <td width="48%" style="background:#F9FAFB;border:2px solid #E5E7EB;border-radius:12px;padding:20px;text-align:center;">
                <p style="margin:0;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.8px;">Your Earnings (USD)</p>
                <p style="margin:6px 0 0;font-size:28px;font-weight:800;color:#059669;">${usdFmt(total.earnings_usd)}</p>
              </td>
            </tr>
            <tr><td colspan="3" style="padding-top:12px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#F9FAFB;border-radius:8px;padding:14px;text-align:center;width:48%;">
                    <p style="margin:0;font-size:22px;font-weight:700;color:#111827;">${total.impressions.toLocaleString('en-IN')}</p>
                    <p style="margin:2px 0 0;font-size:11px;color:#6B7280;">Impressions</p>
                  </td>
                  <td width="4%"></td>
                  <td style="background:#F9FAFB;border-radius:8px;padding:14px;text-align:center;width:48%;">
                    <p style="margin:0;font-size:22px;font-weight:700;color:#111827;">${total.clicks.toLocaleString('en-IN')}</p>
                    <p style="margin:2px 0 0;font-size:11px;color:#6B7280;">Clicks · CTR ${pct(total.clicks, total.impressions)}</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- By Site table -->
        ${by_site.length > 0 ? `
        <tr><td style="padding:0 32px 20px;">
          <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#111827;">📊 Breakdown by Site</p>
          <div style="overflow-x:auto;">
            <table style="${tableStyle}">
              <thead>
                <tr>
                  <th style="${th}">Site</th>
                  <th style="${thR}">Earnings (INR)</th>
                  <th style="${thR}">Earnings (USD)</th>
                  <th style="${thR}">Impressions</th>
                  <th style="${thR}">Clicks</th>
                  <th style="${thR}">CTR</th>
                </tr>
              </thead>
              <tbody>${siteRows}</tbody>
            </table>
          </div>
        </td></tr>` : ''}

        <!-- Daily table (last 30 days) -->
        ${by_day.length > 0 ? `
        <tr><td style="padding:0 32px 20px;">
          <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#111827;">📅 Daily Breakdown${by_day.length > 30 ? ' (most recent 30 days)' : ''}</p>
          <div style="overflow-x:auto;">
            <table style="${tableStyle}">
              <thead>
                <tr>
                  <th style="${th}">Date</th>
                  <th style="${thR}">Earnings (INR)</th>
                  <th style="${thR}">Impressions</th>
                  <th style="${thR}">Clicks</th>
                </tr>
              </thead>
              <tbody>${dayRows}</tbody>
            </table>
          </div>
        </td></tr>` : ''}

        <!-- Note -->
        <tr><td style="padding:0 32px 28px;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.5;">
            Earnings shown are after your revenue share. Recent days may update as ad partners finalise their reports.
            Log into your dashboard for the latest figures.
          </p>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:0 32px 32px;text-align:center;">
          <a href="https://trendingverse.vercel.app/admin/earnings"
            style="display:inline-block;background:#EF4444;color:#fff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;">
            View full report →
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;">
            © 2026 TrendingVerse · <a href="https://trendingverse.vercel.app/admin/earnings" style="color:#6B7280;">Dashboard</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

async function sendViaResend(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.log('[email-report] RESEND_API_KEY not set — skipping send to', to)
    return false
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `TrendingVerse <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    console.error('[email-report] Resend error', res.status, err)
  }
  return res.ok
}

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = user.email === ADMIN_EMAIL
  const body = await req.json().catch(() => ({}))
  const today = new Date().toISOString().split('T')[0]
  const end   = body.end   || today
  const start = body.start || new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0]

  // Non-admins locked to self; admins may target a specific publisher
  const targetPublisher = isAdmin ? (body.publisher_id || user.id) : user.id

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Resolve publisher name + email from user_profiles / auth
  let publisherEmail = user.email || ''
  let publisherName  = user.email?.split('@')[0] || 'Publisher'

  if (isAdmin && body.publisher_id && body.publisher_id !== user.id) {
    // Admin sending on behalf of a publisher — look up their profile
    const { data: prof } = await admin.from('user_profiles').select('full_name, email').eq('id', targetPublisher).maybeSingle()
    if (prof?.email)     publisherEmail = prof.email
    if (prof?.full_name) publisherName  = prof.full_name
  } else {
    const { data: prof } = await admin.from('user_profiles').select('full_name').eq('id', user.id).maybeSingle()
    if (prof?.full_name) publisherName = prof.full_name
  }

  if (!publisherEmail) return NextResponse.json({ error: 'No email on file' }, { status: 400 })

  // Fetch earnings (mirrors /api/mediation/revenue publisher path)
  const { data: sites } = await admin.from('sites').select('id, site_url, name').eq('user_id', targetPublisher)
  const siteName: Record<string, string> = {}
  for (const s of sites || []) siteName[s.id] = s.name || s.site_url

  const { data: rows, error } = await admin
    .from('revenue_reports')
    .select('site_id, report_date, impressions, clicks, publisher_earnings_usd, revenue_inr, revenue_share_pct')
    .eq('publisher_id', targetPublisher)
    .gte('report_date', start)
    .lte('report_date', end)
    .limit(100000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const num = (v: any) => Number(v || 0)
  const enriched = (rows || []).map(r => ({
    site:         siteName[r.site_id] || '(site)',
    date:         r.report_date,
    impressions:  num(r.impressions),
    clicks:       num(r.clicks),
    earnings_usd: num(r.publisher_earnings_usd),
    earnings_inr: +(num(r.revenue_inr) * num(r.revenue_share_pct) / 100).toFixed(2),
  }))

  const total = {
    earnings_usd: +enriched.reduce((s, r) => s + r.earnings_usd, 0).toFixed(4),
    earnings_inr: +enriched.reduce((s, r) => s + r.earnings_inr, 0).toFixed(2),
    impressions: enriched.reduce((s, r) => s + r.impressions, 0),
    clicks:      enriched.reduce((s, r) => s + r.clicks, 0),
  }

  function groupBy(key: 'site' | 'date') {
    const m: Record<string, any> = {}
    for (const r of enriched) {
      const k = key === 'date' ? r.date : r.site
      if (!m[k]) m[k] = { key: k, earnings_usd: 0, earnings_inr: 0, impressions: 0, clicks: 0 }
      m[k].earnings_usd += r.earnings_usd; m[k].earnings_inr += r.earnings_inr
      m[k].impressions  += r.impressions;  m[k].clicks += r.clicks
    }
    return Object.values(m)
      .map((g: any) => ({ ...g, earnings_usd: +g.earnings_usd.toFixed(4), earnings_inr: +g.earnings_inr.toFixed(2) }))
      .sort((a: any, b: any) => String(a.key).localeCompare(String(b.key)))
  }

  const html = buildHtml({
    publisherName,
    publisherEmail,
    start,
    end,
    total,
    by_site: groupBy('site'),
    by_day:  groupBy('date'),
  })

  const subject = `📊 Your TrendingVerse Earnings: ${start} to ${end}`
  const sent = await sendViaResend(publisherEmail, subject, html)

  return NextResponse.json({ ok: true, sent, email: publisherEmail })
}
