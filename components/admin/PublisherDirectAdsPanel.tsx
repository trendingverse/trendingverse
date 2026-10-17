'use client'
// components/admin/PublisherDirectAdsPanel.tsx
// Publisher-facing view of direct ad campaigns running on their sites.
// Shows per-campaign metrics, CSV download, PDF (print) report, and email report.
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface DirectAdRow {
  id: string
  campaign_name: string
  headline: string
  approval_status: string
  is_active: boolean
  start_date: string | null
  end_date: string | null
  cpm_rate_inr: number
  target_site_urls: string[]
  created_at: string
  impressions: number
  clicks: number
  ctr: number
  earned_inr: number
}

interface Site {
  id: string
  site_url: string
  name: string
}

function fmt(n: number) {
  return n.toLocaleString('en-IN')
}
function inrFmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function statusBadge(s: string, active: boolean) {
  if (!active) return 'bg-ink-100 text-ink-500'
  if (s === 'approved' || s === 'active' || s === 'activated') return 'bg-green-100 text-green-700'
  return 'bg-amber-100 text-amber-700'
}
function statusLabel(s: string, active: boolean) {
  if (!active) return 'Paused'
  if (s === 'approved' || s === 'active' || s === 'activated') return 'Active'
  return s
}

export function PublisherDirectAdsPanel({ publisherEmail }: { publisherEmail: string }) {
  const [campaigns, setCampaigns] = useState<DirectAdRow[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [emailing, setEmailing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/publisher/direct-ads')
      .then(r => r.ok ? r.json() : { campaigns: [], sites: [] })
      .then(data => {
        setCampaigns(data.campaigns || [])
        setSites(data.sites || [])
      })
      .finally(() => setLoading(false))
  }, [])

  const totals = campaigns.reduce(
    (acc, c) => ({
      impressions: acc.impressions + c.impressions,
      clicks: acc.clicks + c.clicks,
      earned_inr: acc.earned_inr + c.earned_inr,
    }),
    { impressions: 0, clicks: 0, earned_inr: 0 }
  )
  const totalCtr = totals.impressions > 0
    ? ((totals.clicks / totals.impressions) * 100).toFixed(2)
    : '0.00'

  // ── CSV download ──────────────────────────────────────────────────────────
  function downloadCSV() {
    const header = ['Campaign', 'Status', 'Start', 'End', 'CPM (₹)', 'Impressions', 'Clicks', 'CTR %', 'Earned (₹)']
    const rows = campaigns.map(c => [
      `"${(c.campaign_name || '').replace(/"/g, '""')}"`,
      statusLabel(c.approval_status, c.is_active),
      c.start_date || '',
      c.end_date || '',
      c.cpm_rate_inr.toFixed(2),
      c.impressions,
      c.clicks,
      c.ctr.toFixed(2),
      c.earned_inr.toFixed(2),
    ])
    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `direct-ads-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── PDF via browser print ─────────────────────────────────────────────────
  function downloadPDF() {
    const rows = campaigns.map(c => `
      <tr>
        <td>${c.campaign_name || '—'}</td>
        <td>${statusLabel(c.approval_status, c.is_active)}</td>
        <td>${c.start_date || '—'}</td>
        <td>${c.end_date || 'Ongoing'}</td>
        <td style="text-align:right">₹${c.cpm_rate_inr.toFixed(2)}</td>
        <td style="text-align:right">${fmt(c.impressions)}</td>
        <td style="text-align:right">${fmt(c.clicks)}</td>
        <td style="text-align:right">${c.ctr.toFixed(2)}%</td>
        <td style="text-align:right">${inrFmt(c.earned_inr)}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Direct Ads Report — ${new Date().toLocaleDateString('en-IN')}</title>
<style>
  body{font-family:Arial,sans-serif;color:#1f2937;padding:32px;font-size:13px}
  h1{font-size:20px;margin:0 0 4px}
  p.sub{color:#6b7280;font-size:12px;margin:0 0 24px}
  .stats{display:flex;gap:24px;margin-bottom:28px}
  .stat{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 20px;min-width:120px}
  .stat .val{font-size:22px;font-weight:700}
  .stat .lbl{font-size:11px;color:#6b7280;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#111827;color:#fff;padding:8px 10px;text-align:left}
  td{padding:7px 10px;border-bottom:1px solid #e5e7eb}
  tr:nth-child(even) td{background:#f9fafb}
  .footer{margin-top:24px;font-size:11px;color:#9ca3af;text-align:center}
  @media print{body{padding:0}}
</style></head><body>
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
  <div>
    <h1>Trending<span style="color:#ef4444">Verse</span></h1>
    <p class="sub">Direct Ad Campaigns Report · Generated ${new Date().toLocaleString('en-IN')}</p>
  </div>
  <div style="font-size:12px;color:#6b7280;text-align:right">
    Publisher: ${publisherEmail}<br>
    Sites: ${sites.map(s => s.name || s.site_url).join(', ')}
  </div>
</div>
<div class="stats">
  <div class="stat"><div class="val">${campaigns.length}</div><div class="lbl">Campaigns</div></div>
  <div class="stat"><div class="val">${fmt(totals.impressions)}</div><div class="lbl">Impressions</div></div>
  <div class="stat"><div class="val">${fmt(totals.clicks)}</div><div class="lbl">Clicks</div></div>
  <div class="stat"><div class="val">${totalCtr}%</div><div class="lbl">Avg CTR</div></div>
  <div class="stat"><div class="val" style="color:#059669">${inrFmt(totals.earned_inr)}</div><div class="lbl">Est. Earnings</div></div>
</div>
<table>
  <thead><tr>
    <th>Campaign</th><th>Status</th><th>Start</th><th>End</th>
    <th style="text-align:right">CPM ₹</th>
    <th style="text-align:right">Impressions</th>
    <th style="text-align:right">Clicks</th>
    <th style="text-align:right">CTR</th>
    <th style="text-align:right">Earned ₹</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<p class="footer">© ${new Date().getFullYear()} TrendingVerse · trendingverse.online</p>
</body></html>`

    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) { toast.error('Please allow popups to download PDF'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 500)
  }

  // ── Email report for one campaign ─────────────────────────────────────────
  async function emailCampaignReport(campaignId: string) {
    setEmailing(campaignId)
    try {
      const res = await fetch('/api/audience/track/campaign-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, email: publisherEmail }),
      })
      if (res.ok) {
        toast.success(`Report sent to ${publisherEmail}`)
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Failed to send email')
      }
    } finally {
      setEmailing(null)
    }
  }

  // ── Email full summary ────────────────────────────────────────────────────
  async function emailFullReport() {
    setEmailing('all')
    try {
      const res = await fetch('/api/publisher/email-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        toast.success(`Full earnings report sent to ${publisherEmail}`)
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Failed to send report')
      }
    } finally {
      setEmailing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-ink-300 text-sm">
        Loading your campaigns…
      </div>
    )
  }

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
          <button onClick={downloadCSV} disabled={campaigns.length === 0}
            className="btn-secondary btn-sm disabled:opacity-40">
            ⬇ CSV
          </button>
          <button onClick={downloadPDF} disabled={campaigns.length === 0}
            className="btn-secondary btn-sm disabled:opacity-40">
            🖨 PDF
          </button>
          <button
            onClick={emailFullReport}
            disabled={emailing === 'all' || campaigns.length === 0}
            className="btn-primary btn-sm disabled:opacity-40">
            {emailing === 'all' ? 'Sending…' : '✉ Email Report'}
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active Campaigns', value: campaigns.filter(c => c.is_active).length, icon: '📢', color: 'text-ink-900' },
            { label: 'Impressions', value: fmt(totals.impressions), icon: '👁', color: 'text-ink-900' },
            { label: 'Clicks', value: fmt(totals.clicks), icon: '👆', color: 'text-ink-900' },
            { label: 'Est. Earnings', value: inrFmt(totals.earned_inr), icon: '₹', color: 'text-green-600' },
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
          <p className="text-sm text-ink-400 mt-1">
            Once an admin assigns a direct campaign to your site, it will appear here.
          </p>
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
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-500">Clicks</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-500">CTR</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-500">CPM ₹</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-500">Earned ₹</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-ink-500">Report</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => (
                  <>
                    <tr
                      key={c.id}
                      className="border-b border-ink-50 hover:bg-ink-50/50 cursor-pointer"
                      onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink-900 text-xs">{c.campaign_name}</p>
                        {c.headline && (
                          <p className="text-ink-400 text-xs truncate max-w-[200px]">{c.headline}</p>
                        )}
                        <p className="text-ink-300 text-xs mt-0.5">
                          {c.start_date || '—'} → {c.end_date || 'Ongoing'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(c.approval_status, c.is_active)}`}>
                          {statusLabel(c.approval_status, c.is_active)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-ink-900">{fmt(c.impressions)}</td>
                      <td className="px-4 py-3 text-right text-xs text-ink-700">{fmt(c.clicks)}</td>
                      <td className={`px-4 py-3 text-right text-xs font-medium ${c.ctr > 1 ? 'text-green-600' : c.ctr > 0 ? 'text-amber-600' : 'text-ink-400'}`}>
                        {c.ctr.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-ink-700">₹{c.cpm_rate_inr.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-green-600">
                        {inrFmt(c.earned_inr)}
                      </td>
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
                    {expanded === c.id && (
                      <tr key={c.id + '-detail'} className="bg-ink-50/60">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-ink-600">
                            <div>
                              <span className="font-medium text-ink-900">Campaign ID</span>
                              <p className="font-mono text-ink-400 text-xs mt-0.5 truncate">{c.id}</p>
                            </div>
                            <div>
                              <span className="font-medium text-ink-900">Sites targeted</span>
                              <p className="text-ink-400 mt-0.5">
                                {c.target_site_urls.length > 0
                                  ? c.target_site_urls.join(', ')
                                  : 'All sites'}
                              </p>
                            </div>
                            <div>
                              <span className="font-medium text-ink-900">eCPM</span>
                              <p className="text-ink-400 mt-0.5">
                                {c.impressions > 0
                                  ? inrFmt((c.earned_inr / c.impressions) * 1000)
                                  : '—'}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-ink-50 border-t-2 border-ink-100">
                  <td colSpan={2} className="px-4 py-2.5 text-xs font-semibold text-ink-700">
                    Total ({campaigns.length} campaigns)
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold text-ink-900">{fmt(totals.impressions)}</td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold text-ink-900">{fmt(totals.clicks)}</td>
                  <td className="px-4 py-2.5 text-right text-xs font-bold text-ink-900">{totalCtr}%</td>
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
        Earnings are estimates based on CPM rate × impressions delivered. Click a row to expand details.
      </p>
    </div>
  )
}
