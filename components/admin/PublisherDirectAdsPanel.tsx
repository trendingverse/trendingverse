'use client'
// components/admin/PublisherDirectAdsPanel.tsx
// Publisher-facing view of direct ad campaigns.
// Video campaigns (inbanner_video, outstream) show VTR + VCR; display shows CTR.
// Click a campaign row → day-wise performance table.
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface DirectAdRow {
  id: string
  campaign_name: string
  headline: string
  ad_type: string
  is_video: boolean
  approval_status: string
  is_active: boolean
  start_date: string | null
  end_date: string | null
  cpm_rate_inr: number
  target_site_urls: string[]
  created_at: string
  impressions: number
  clicks: number
  video_views: number
  video_completions: number
  ctr: number
  vtr: number
  vcr: number
  earned_inr: number
}

interface DayRow {
  date: string
  impressions: number
  clicks: number
  video_views: number
  video_completions: number
  ctr: number
  vtr: number
  vcr: number
}

interface Site { id: string; site_url: string; name: string }

function fmt(n: number) { return n.toLocaleString('en-IN') }
function inrFmt(n: number) { return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function pct(n: number) { return n.toFixed(2) + '%' }

function statusBadge(s: string, active: boolean) {
  if (!active) return 'bg-ink-100 text-ink-500'
  if (['approved','active','activated'].includes(s)) return 'bg-green-100 text-green-700'
  return 'bg-amber-100 text-amber-700'
}
function statusLabel(s: string, active: boolean) {
  if (!active) return 'Paused'
  if (['approved','active','activated'].includes(s)) return 'Active'
  return s
}

function adTypeLabel(t: string) {
  if (t === 'inbanner_video') return '🎬 In-Banner Video'
  if (t === 'outstream')      return '📺 Outstream'
  return '🖼 Display'
}

export function PublisherDirectAdsPanel({ publisherEmail }: { publisherEmail: string }) {
  const [campaigns, setCampaigns] = useState<DirectAdRow[]>([])
  const [sites, setSites]         = useState<Site[]>([])
  const [loading, setLoading]     = useState(true)
  const [emailing, setEmailing]   = useState<string | null>(null)
  // expanded = campaign id that is drilled into
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [dailyData, setDailyData] = useState<Record<string, { rows: DayRow[]; loading: boolean }>>({})

  useEffect(() => {
    fetch('/api/publisher/direct-ads')
      .then(r => r.ok ? r.json() : { campaigns: [], sites: [] })
      .then(data => {
        setCampaigns(data.campaigns || [])
        setSites(data.sites || [])
      })
      .finally(() => setLoading(false))
  }, [])

  function toggleExpand(id: string) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!dailyData[id]) {
      setDailyData(prev => ({ ...prev, [id]: { rows: [], loading: true } }))
      fetch(`/api/publisher/direct-ads?campaign_id=${id}&breakdown=daily`)
        .then(r => r.ok ? r.json() : { by_day: [] })
        .then(data => setDailyData(prev => ({ ...prev, [id]: { rows: data.by_day || [], loading: false } })))
        .catch(() => setDailyData(prev => ({ ...prev, [id]: { rows: [], loading: false } })))
    }
  }

  const totals = campaigns.reduce(
    (acc, c) => ({
      impressions: acc.impressions + c.impressions,
      clicks: acc.clicks + c.clicks,
      video_views: acc.video_views + c.video_views,
      video_completions: acc.video_completions + c.video_completions,
      earned_inr: acc.earned_inr + c.earned_inr,
    }),
    { impressions: 0, clicks: 0, video_views: 0, video_completions: 0, earned_inr: 0 }
  )

  const hasVideo   = campaigns.some(c => c.is_video)
  const hasDisplay = campaigns.some(c => !c.is_video)

  // ── CSV ───────────────────────────────────────────────────────────────────
  function downloadCSV() {
    const header = ['Campaign', 'Type', 'Status', 'Start', 'End', 'CPM (₹)',
      'Impressions', 'Clicks', 'CTR %', 'Video Views', 'VTR %', 'Video Completions', 'VCR %', 'Earned (₹)']
    const rows = campaigns.map(c => [
      `"${(c.campaign_name || '').replace(/"/g, '""')}"`,
      c.ad_type,
      statusLabel(c.approval_status, c.is_active),
      c.start_date || '', c.end_date || '',
      c.cpm_rate_inr.toFixed(2), c.impressions, c.clicks,
      c.is_video ? '' : c.ctr.toFixed(2),
      c.is_video ? c.video_views : '',
      c.is_video ? c.vtr.toFixed(2) : '',
      c.is_video ? c.video_completions : '',
      c.is_video ? c.vcr.toFixed(2) : '',
      c.earned_inr.toFixed(2),
    ])
    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `campaigns-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  function downloadPDF() {
    const rows = campaigns.map(c => `
      <tr>
        <td>${c.campaign_name || '—'}</td>
        <td>${adTypeLabel(c.ad_type)}</td>
        <td>${statusLabel(c.approval_status, c.is_active)}</td>
        <td>${c.start_date || '—'}</td>
        <td>${c.end_date || 'Ongoing'}</td>
        <td style="text-align:right">₹${c.cpm_rate_inr.toFixed(2)}</td>
        <td style="text-align:right">${fmt(c.impressions)}</td>
        ${c.is_video
          ? `<td style="text-align:right">${fmt(c.video_views)}</td>
             <td style="text-align:right">${pct(c.vtr)}</td>
             <td style="text-align:right">${fmt(c.video_completions)}</td>
             <td style="text-align:right">${pct(c.vcr)}</td>`
          : `<td style="text-align:right">${fmt(c.clicks)}</td>
             <td style="text-align:right">${pct(c.ctr)}</td>
             <td style="text-align:right">—</td>
             <td style="text-align:right">—</td>`}
        <td style="text-align:right">${inrFmt(c.earned_inr)}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Campaign Report — ${new Date().toLocaleDateString('en-IN')}</title>
<style>
  body{font-family:Arial,sans-serif;color:#1f2937;padding:32px;font-size:13px}
  h1{font-size:20px;margin:0 0 4px}p.sub{color:#6b7280;font-size:12px;margin:0 0 24px}
  .stats{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:24px}
  .stat{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 18px;min-width:100px}
  .stat .val{font-size:20px;font-weight:700}.stat .lbl{font-size:11px;color:#6b7280;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#111827;color:#fff;padding:7px 8px;text-align:left}
  td{padding:6px 8px;border-bottom:1px solid #e5e7eb}
  tr:nth-child(even) td{background:#f9fafb}
  .footer{margin-top:24px;font-size:11px;color:#9ca3af;text-align:center}
  @media print{body{padding:0}}
</style></head><body>
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
  <div>
    <h1>Trending<span style="color:#ef4444">Verse</span></h1>
    <p class="sub">Campaign Report · Generated ${new Date().toLocaleString('en-IN')}</p>
  </div>
  <div style="font-size:11px;color:#6b7280;text-align:right">
    Publisher: ${publisherEmail}<br>Sites: ${sites.map(s => s.name || s.site_url).join(', ')}
  </div>
</div>
<div class="stats">
  <div class="stat"><div class="val">${campaigns.length}</div><div class="lbl">Campaigns</div></div>
  <div class="stat"><div class="val">${fmt(totals.impressions)}</div><div class="lbl">Impressions</div></div>
  ${hasVideo ? `<div class="stat"><div class="val">${fmt(totals.video_views)}</div><div class="lbl">Video Views</div></div>
  <div class="stat"><div class="val">${fmt(totals.video_completions)}</div><div class="lbl">Completions</div></div>` : ''}
  ${hasDisplay ? `<div class="stat"><div class="val">${fmt(totals.clicks)}</div><div class="lbl">Clicks</div></div>` : ''}
  <div class="stat"><div class="val" style="color:#059669">${inrFmt(totals.earned_inr)}</div><div class="lbl">Est. Earnings</div></div>
</div>
<table>
  <thead><tr>
    <th>Campaign</th><th>Type</th><th>Status</th><th>Start</th><th>End</th>
    <th style="text-align:right">CPM ₹</th>
    <th style="text-align:right">Impressions</th>
    <th style="text-align:right">Views / Clicks</th>
    <th style="text-align:right">VTR / CTR</th>
    <th style="text-align:right">Completions</th>
    <th style="text-align:right">VCR</th>
    <th style="text-align:right">Earned ₹</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<p class="footer">© ${new Date().getFullYear()} TrendingVerse · trendingverse.online</p>
</body></html>`

    const win = window.open('', '_blank', 'width=1000,height=700')
    if (!win) { toast.error('Please allow popups to download PDF'); return }
    win.document.write(html); win.document.close(); win.focus()
    setTimeout(() => { win.print(); win.close() }, 500)
  }

  // ── Email ─────────────────────────────────────────────────────────────────
  async function emailCampaignReport(campaignId: string) {
    setEmailing(campaignId)
    try {
      const res = await fetch('/api/audience/track/campaign-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, email: publisherEmail }),
      })
      if (res.ok) toast.success(`Report sent to ${publisherEmail}`)
      else { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Failed to send') }
    } finally { setEmailing(null) }
  }

  async function emailFullReport() {
    setEmailing('all')
    try {
      const res = await fetch('/api/publisher/email-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      if (res.ok) toast.success(`Report sent to ${publisherEmail}`)
      else { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Failed') }
    } finally { setEmailing(null) }
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-ink-300 text-sm">Loading your campaigns…</div>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-ink-900">📢 Your Direct Ad Campaigns</h3>
          <p className="text-xs text-ink-400 mt-0.5">
            Campaigns currently serving on your site{sites.length > 1 ? 's' : ''}
            {sites.length > 0 && ': ' + sites.map(s => s.name || s.site_url).join(', ')}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={downloadCSV} disabled={campaigns.length === 0} className="btn-secondary btn-sm disabled:opacity-40">⬇ CSV</button>
          <button onClick={downloadPDF} disabled={campaigns.length === 0} className="btn-secondary btn-sm disabled:opacity-40">🖨 PDF</button>
          <button onClick={emailFullReport} disabled={emailing === 'all' || campaigns.length === 0} className="btn-primary btn-sm disabled:opacity-40">
            {emailing === 'all' ? 'Sending…' : '✉ Email Report'}
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active Campaigns',  value: campaigns.filter(c => c.is_active).length, icon: '📢', color: 'text-ink-900' },
            { label: 'Impressions',        value: fmt(totals.impressions),                   icon: '👁',  color: 'text-ink-900' },
            ...(hasVideo
              ? [
                  { label: 'Video Views',    value: fmt(totals.video_views),        icon: '▶️', color: 'text-blue-600' },
                  { label: 'Completions',    value: fmt(totals.video_completions),  icon: '✅', color: 'text-blue-600' },
                ]
              : [
                  { label: 'Clicks',         value: fmt(totals.clicks),             icon: '👆', color: 'text-ink-900' },
                ]
            ),
            { label: 'Est. Earnings',      value: inrFmt(totals.earned_inr),                 icon: '₹',  color: 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ink-400">{s.label}</span>
                <span className="text-base">{s.icon}</span>
              </div>
              <div className={`text-xl font-display font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Campaign table */}
      {campaigns.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-3xl mb-3">📭</p>
          <p className="font-medium text-ink-700">No campaigns assigned yet</p>
          <p className="text-sm text-ink-400 mt-1">Once an admin assigns a direct campaign to your site, it will appear here.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50 border-b border-ink-100">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-ink-500">Campaign</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-ink-500">Status</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-500">Impressions</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-500">Views / Clicks</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-500">VTR / CTR</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-500">VCR</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-500">CPM ₹</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-500">Earned ₹</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-ink-500">Report</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => {
                  const isOpen = expanded === c.id
                  const daily  = dailyData[c.id]
                  return (
                    <>
                      <tr
                        key={c.id}
                        className="border-b border-ink-50 hover:bg-ink-50/50 cursor-pointer"
                        onClick={() => toggleExpand(c.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-ink-300 text-xs">{isOpen ? '▼' : '▶'}</span>
                            <div>
                              <p className="font-medium text-ink-900 text-xs">{c.campaign_name}</p>
                              <p className="text-ink-400 text-xs mt-0.5">{adTypeLabel(c.ad_type)}</p>
                              <p className="text-ink-300 text-xs">{c.start_date || '—'} → {c.end_date || 'Ongoing'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(c.approval_status, c.is_active)}`}>
                            {statusLabel(c.approval_status, c.is_active)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-medium text-ink-900">{fmt(c.impressions)}</td>
                        {/* Views / Clicks */}
                        <td className="px-4 py-3 text-right text-xs text-ink-700">
                          {c.is_video ? fmt(c.video_views) : fmt(c.clicks)}
                        </td>
                        {/* VTR or CTR */}
                        <td className={`px-4 py-3 text-right text-xs font-medium ${
                          c.is_video
                            ? (c.vtr > 50 ? 'text-green-600' : c.vtr > 20 ? 'text-amber-600' : 'text-ink-400')
                            : (c.ctr > 1  ? 'text-green-600' : c.ctr > 0  ? 'text-amber-600' : 'text-ink-400')
                        }`}>
                          {c.is_video ? pct(c.vtr) : pct(c.ctr)}
                        </td>
                        {/* VCR — blank for display */}
                        <td className={`px-4 py-3 text-right text-xs font-medium ${
                          c.is_video ? (c.vcr > 30 ? 'text-green-600' : 'text-amber-600') : 'text-ink-300'
                        }`}>
                          {c.is_video ? pct(c.vcr) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-ink-700">₹{c.cpm_rate_inr.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-xs font-medium text-green-600">{inrFmt(c.earned_inr)}</td>
                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => emailCampaignReport(c.id)}
                            disabled={emailing === c.id}
                            title={`Email report to ${publisherEmail}`}
                            className="text-xs px-2 py-1 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40">
                            {emailing === c.id ? '…' : '✉'}
                          </button>
                        </td>
                      </tr>

                      {/* Day-wise drill-down */}
                      {isOpen && (
                        <tr key={c.id + '-daily'} className="bg-ink-50/40">
                          <td colSpan={9} className="px-6 py-4">
                            {daily?.loading ? (
                              <p className="text-xs text-ink-400">Loading day-wise data…</p>
                            ) : !daily || daily.rows.length === 0 ? (
                              <p className="text-xs text-ink-400">No daily data available yet.</p>
                            ) : (
                              <div>
                                <p className="text-xs font-semibold text-ink-700 mb-2">Day-wise Performance</p>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs border border-ink-100 rounded-lg overflow-hidden">
                                    <thead>
                                      <tr className="bg-ink-100">
                                        <th className="text-left px-3 py-2 text-ink-500 font-medium">Date</th>
                                        <th className="text-right px-3 py-2 text-ink-500 font-medium">Impressions</th>
                                        {c.is_video ? (
                                          <>
                                            <th className="text-right px-3 py-2 text-ink-500 font-medium">Video Views</th>
                                            <th className="text-right px-3 py-2 text-ink-500 font-medium">VTR</th>
                                            <th className="text-right px-3 py-2 text-ink-500 font-medium">Completions</th>
                                            <th className="text-right px-3 py-2 text-ink-500 font-medium">VCR</th>
                                          </>
                                        ) : (
                                          <>
                                            <th className="text-right px-3 py-2 text-ink-500 font-medium">Clicks</th>
                                            <th className="text-right px-3 py-2 text-ink-500 font-medium">CTR</th>
                                          </>
                                        )}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {daily.rows.map((d, i) => (
                                        <tr key={d.date} className={i % 2 === 0 ? 'bg-white' : 'bg-ink-50/60'}>
                                          <td className="px-3 py-2 text-ink-700 font-medium">{d.date}</td>
                                          <td className="px-3 py-2 text-right text-ink-900">{fmt(d.impressions)}</td>
                                          {c.is_video ? (
                                            <>
                                              <td className="px-3 py-2 text-right text-blue-700">{fmt(d.video_views)}</td>
                                              <td className="px-3 py-2 text-right font-medium text-blue-600">{pct(d.vtr)}</td>
                                              <td className="px-3 py-2 text-right text-green-700">{fmt(d.video_completions)}</td>
                                              <td className="px-3 py-2 text-right font-medium text-green-600">{pct(d.vcr)}</td>
                                            </>
                                          ) : (
                                            <>
                                              <td className="px-3 py-2 text-right text-ink-700">{fmt(d.clicks)}</td>
                                              <td className="px-3 py-2 text-right font-medium">{pct(d.ctr)}</td>
                                            </>
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                    {/* Totals row */}
                                    <tfoot>
                                      <tr className="bg-ink-100 font-semibold">
                                        <td className="px-3 py-2 text-ink-700">Total</td>
                                        <td className="px-3 py-2 text-right text-ink-900">
                                          {fmt(daily.rows.reduce((s, d) => s + d.impressions, 0))}
                                        </td>
                                        {c.is_video ? (
                                          <>
                                            <td className="px-3 py-2 text-right text-blue-700">
                                              {fmt(daily.rows.reduce((s, d) => s + d.video_views, 0))}
                                            </td>
                                            <td className="px-3 py-2 text-right text-blue-600">
                                              {(() => {
                                                const ti = daily.rows.reduce((s, d) => s + d.impressions, 0)
                                                const tv = daily.rows.reduce((s, d) => s + d.video_views, 0)
                                                return ti > 0 ? pct((tv / ti) * 100) : '—'
                                              })()}
                                            </td>
                                            <td className="px-3 py-2 text-right text-green-700">
                                              {fmt(daily.rows.reduce((s, d) => s + d.video_completions, 0))}
                                            </td>
                                            <td className="px-3 py-2 text-right text-green-600">
                                              {(() => {
                                                const ti = daily.rows.reduce((s, d) => s + d.impressions, 0)
                                                const vc = daily.rows.reduce((s, d) => s + d.video_completions, 0)
                                                return ti > 0 ? pct((vc / ti) * 100) : '—'
                                              })()}
                                            </td>
                                          </>
                                        ) : (
                                          <>
                                            <td className="px-3 py-2 text-right text-ink-700">
                                              {fmt(daily.rows.reduce((s, d) => s + d.clicks, 0))}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                              {(() => {
                                                const ti = daily.rows.reduce((s, d) => s + d.impressions, 0)
                                                const tc = daily.rows.reduce((s, d) => s + d.clicks, 0)
                                                return ti > 0 ? pct((tc / ti) * 100) : '—'
                                              })()}
                                            </td>
                                          </>
                                        )}
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-ink-50 border-t-2 border-ink-100">
                  <td colSpan={2} className="px-4 py-2.5 text-xs font-semibold text-ink-700">Total ({campaigns.length})</td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold text-ink-900">{fmt(totals.impressions)}</td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold text-ink-900">
                    {hasVideo ? fmt(totals.video_views) : fmt(totals.clicks)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-ink-400">—</td>
                  <td className="px-4 py-2.5 text-right text-xs text-ink-400">—</td>
                  <td className="px-4 py-2.5 text-right text-xs text-ink-400">—</td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold text-green-600">{inrFmt(totals.earned_inr)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-ink-300 text-center">
        Click any campaign row to see day-wise performance. Earnings are estimates based on CPM × impressions.
      </p>
    </div>
  )
}
