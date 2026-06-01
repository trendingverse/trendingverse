'use client'
import { useState, useEffect } from 'react'

interface Totals {
  impressions: number; clicks: number; cpm: number; ctr: number
  revenue_usd?: number; revenue_inr?: number
  publisher_earnings_usd?: number; platform_earnings_usd?: number
  your_earnings_usd?: number; your_earnings_inr?: number
}
interface ChartPoint {
  date: string; impressions: number; clicks: number
  revenue?: number; earnings?: number; ctr?: number; cpm?: number
}
interface DomainRow {
  domain: string; site_name: string; impressions: number; clicks: number
  ctr: number; cpm: number; gross_revenue: number
  publisher_earnings: number; platform_earnings: number; revenue_share_pct: number
}
interface StatCard { label: string; value: string; icon: string; color: string }

function today() { return new Date().toISOString().split('T')[0] }
function daysAgo(n: number) { return new Date(Date.now() - n * 86400000).toISOString().split('T')[0] }

export function AdsterraDashboard({ isAdmin = false }: { isAdmin?: boolean }) {
  const [data, setData] = useState<{
    role?: string; totals?: Totals; chartData?: ChartPoint[]
    domains?: DomainRow[]; error?: string; no_site?: boolean
    period?: { startDate: string; endDate: string }
    revenue_share_pct?: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'domains'>('overview')

  // Date selection
  const [dateMode, setDateMode] = useState<'preset' | 'custom'>('preset')
  const [preset, setPreset] = useState('7')
  const [customStart, setCustomStart] = useState(daysAgo(7))
  const [customEnd, setCustomEnd] = useState(today())

  // Export
  const [showExport, setShowExport] = useState(false)
  const [exportEmail, setExportEmail] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  useEffect(() => { fetchData() }, [preset, dateMode === 'preset' ? preset : customStart + customEnd])

  async function fetchData() {
    setLoading(true)
    try {
      const url = dateMode === 'custom'
        ? `/api/adsterra?start=${customStart}&end=${customEnd}`
        : `/api/adsterra?period=${preset}`
      const res = await fetch(url)
      const d = await res.json()
      setData(d)
    } catch (e) {
      setData({ error: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }

  // CSV export
  function exportCSV() {
    if (!data?.chartData?.length) return
    const headers = isAdmin && !isPublisher
  ? ['Date', 'Impressions', 'Clicks', 'CTR%', 'CPM', 'Revenue USD']
  : ['Date', 'Impressions', 'Clicks', 'Earnings USD']
    const rows = data.chartData.map(d => isAdmin && !isPublisher
      ? [d.date, d.impressions, d.clicks, d.ctr ?? '', d.cpm ?? '', d.revenue ?? '']
      : [d.date, d.impressions, d.clicks, d.earnings ?? '']
    )
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    download(csv, 'text/csv', `trendingverse-revenue-${data?.period?.startDate || daysAgo(parseInt(preset))}-to-${data?.period?.endDate || today()}.csv`)
  }

  // Excel export (TSV that Excel opens)
  function exportExcel() {
    if (!data?.chartData?.length) return
    const headers = isAdmin
      ? ['Date', 'Impressions', 'Clicks', 'CTR%', 'CPM', 'Revenue USD']
      : ['Date', 'Impressions', 'Clicks', 'Earnings USD']
    const rows = data.chartData.map(d => isAdmin && !isPublisher
      ? [d.date, d.impressions, d.clicks, d.ctr ?? '', d.cpm ?? '', d.revenue ?? '']
      : [d.date, d.impressions, d.clicks, d.earnings ?? '']
    )
    const tsv = [headers, ...rows].map(r => r.join('\t')).join('\n')
    download(tsv, 'application/vnd.ms-excel', `trendingverse-revenue-${data?.period?.startDate || daysAgo(parseInt(preset))}-to-${data?.period?.endDate || today()}.xls`)
  }

  // PDF export (simple print)
function exportPDF() {
  const period = data?.period
  const totals = data?.totals
  const rows = (data?.chartData || []).map(d =>
    `<tr>
      <td>${d.date}</td>
      <td>${d.impressions}</td>
      <td>${d.clicks}</td>
      <td>${d.ctr ?? 0}%</td>
      <td>$${(d.revenue ?? d.earnings ?? 0).toFixed(4)}</td>
    </tr>`
  ).join('')

  const html = `<!DOCTYPE html><html><head><title>Revenue Report</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    p { color: #666; font-size: 13px; margin-bottom: 24px; }
    .stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 24px; }
    .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    .stat-label { font-size: 11px; color: #9ca3af; margin-bottom: 4px; }
    .stat-value { font-size: 20px; font-weight: 700; color: #111; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f9fafb; text-align: left; padding: 8px 12px; border-bottom: 2px solid #e5e7eb; font-size: 11px; color: #6b7280; text-transform: uppercase; }
    td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
    tr:hover td { background: #f9fafb; }
    .footer { margin-top: 32px; font-size: 11px; color: #9ca3af; text-align: center; }
  </style></head><body>
  <h1>TrendingVerse — Ad Revenue Report</h1>
  <p>Period: ${period?.startDate} → ${period?.endDate} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
  <div class="stats">
    <div class="stat"><div class="stat-label">Impressions</div><div class="stat-value">${totals?.impressions?.toLocaleString()}</div></div>
    <div class="stat"><div class="stat-label">Clicks</div><div class="stat-value">${totals?.clicks?.toLocaleString()}</div></div>
    <div class="stat"><div class="stat-label">CTR</div><div class="stat-value">${totals?.ctr}%</div></div>
    <div class="stat"><div class="stat-label">eCPM</div><div class="stat-value">$${totals?.cpm}</div></div>
    ${isAdmin ? `
    <div class="stat"><div class="stat-label">Total Revenue</div><div class="stat-value" style="color:#16a34a">$${totals?.revenue_usd}</div></div>
    <div class="stat"><div class="stat-label">Publisher Payouts</div><div class="stat-value" style="color:#2563eb">$${totals?.publisher_earnings_usd}</div></div>
    <div class="stat"><div class="stat-label">Platform Earnings</div><div class="stat-value" style="color:#7c3aed">$${totals?.platform_earnings_usd}</div></div>
    <div class="stat"><div class="stat-label">Revenue (INR)</div><div class="stat-value">₹${totals?.revenue_inr}</div></div>
    ` : `
    <div class="stat"><div class="stat-label">Your Earnings (USD)</div><div class="stat-value" style="color:#16a34a">$${totals?.your_earnings_usd}</div></div>
    <div class="stat"><div class="stat-label">Your Earnings (INR)</div><div class="stat-value" style="color:#059669">₹${totals?.your_earnings_inr}</div></div>
    `}
  </div>
  <table>
    <thead><tr><th>Date</th><th>Impressions</th><th>Clicks</th><th>CTR</th><th>${isAdmin ? 'Revenue' : 'Earnings'}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">TrendingVerse CMS · trendingverse.vercel.app</div>
  </body></html>`

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 500)
  }
}
  function download(content: string, type: string, filename: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  async function sendEmailReport() {
    if (!exportEmail) return
    setSendingEmail(true)
    try {
      // Build report content
      const totals = data?.totals
      const period = data?.period
      const html = `
        <h2>TrendingVerse Ad Revenue Report</h2>
        <p>Period: ${period?.startDate} → ${period?.endDate}</p>
        <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">
          <tr style="background:#f3f4f6">
            <th>Metric</th><th>Value</th>
          </tr>
          <tr><td>Impressions</td><td>${totals?.impressions?.toLocaleString()}</td></tr>
          <tr><td>Clicks</td><td>${totals?.clicks?.toLocaleString()}</td></tr>
          <tr><td>CTR</td><td>${totals?.ctr}%</td></tr>
          <tr><td>eCPM</td><td>$${totals?.cpm}</td></tr>
          ${isAdmin ? `
          <tr><td>Total Revenue (USD)</td><td>$${totals?.revenue_usd}</td></tr>
          <tr><td>Publisher Payouts</td><td>$${totals?.publisher_earnings_usd}</td></tr>
          <tr><td>Platform Earnings</td><td>$${totals?.platform_earnings_usd}</td></tr>
          ` : `
          <tr><td>Your Earnings (USD)</td><td>$${totals?.your_earnings_usd}</td></tr>
          <tr><td>Your Earnings (INR)</td><td>₹${totals?.your_earnings_inr}</td></tr>
          `}
        </table>
        <br/>
        <h3>Daily Breakdown</h3>
        <table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">
          <tr style="background:#f3f4f6">
            <th>Date</th><th>Impressions</th><th>Clicks</th>${isAdmin ? '<th>Revenue</th>' : '<th>Earnings</th>'}
          </tr>
          ${(data?.chartData || []).map(d => `
          <tr>
            <td>${d.date}</td>
            <td>${d.impressions}</td>
            <td>${d.clicks}</td>
            <td>${isAdmin ? '$' + (d.revenue ?? 0) : '$' + (d.earnings ?? 0)}</td>
          </tr>`).join('')}
        </table>
      `
      await fetch('/api/email/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: exportEmail,
          subject_override: `TrendingVerse Revenue Report: ${period?.startDate} → ${period?.endDate}`,
          html_override: html,
        }),
      })
      alert(`Report sent to ${exportEmail}`)
      setShowExport(false)
      setExportEmail('')
    } catch { alert('Failed to send email') }
    setSendingEmail(false)
  }

  if (loading) return (
    <div className="space-y-4">
      {Array(2).fill(0).map((_, i) => <div key={i} className="h-20 bg-ink-50 rounded-xl animate-pulse" />)}
    </div>
  )

  if (data?.no_site) return (
    <div className="card p-6 text-center">
      <p className="text-3xl mb-2">🌐</p>
      <p className="text-sm text-ink-500">Connect your WordPress site in Settings to see your earnings</p>
    </div>
  )

  if (data?.error) return (
    <div className="card p-6 text-center">
      <p className="text-red-500 text-sm">{data.error}</p>
      <button onClick={fetchData} className="mt-3 text-xs px-3 py-1.5 bg-ink-100 rounded-lg">Retry</button>
    </div>
  )

  const { totals, chartData = [], domains = [] } = data || {}
  const isPublisher = data?.role === 'publisher'
  const maxVal = Math.max(...chartData.map(d => d.revenue || d.earnings || 0), 0.001)

  const publisherCards: StatCard[] = totals ? [
    { label: 'Your Earnings (USD)', value: `$${totals.your_earnings_usd?.toFixed(4) || '0.0000'}`, icon: '💰', color: 'text-green-600' },
    { label: 'Your Earnings (INR)', value: `₹${totals.your_earnings_inr?.toFixed(2) || '0.00'}`, icon: '₹', color: 'text-emerald-600' },
    { label: 'Impressions', value: totals.impressions.toLocaleString(), icon: '👁', color: 'text-blue-600' },
    { label: 'Clicks', value: totals.clicks.toLocaleString(), icon: '👆', color: 'text-violet-600' },
    { label: 'eCPM', value: `$${totals.cpm.toFixed(4)}`, icon: '📊', color: 'text-amber-600' },
    { label: 'CTR', value: `${totals.ctr}%`, icon: '📈', color: totals.ctr > 1 ? 'text-green-600' : 'text-amber-500' },
  ] : []

  const adminCards: StatCard[] = totals ? [
    { label: 'Total Revenue (USD)', value: `$${totals.revenue_usd?.toFixed(4) || '0.0000'}`, icon: '💰', color: 'text-green-600' },
    { label: 'Publisher Payouts', value: `$${totals.publisher_earnings_usd?.toFixed(4) || '0.0000'}`, icon: '👤', color: 'text-blue-600' },
    { label: 'Platform Earnings', value: `$${totals.platform_earnings_usd?.toFixed(4) || '0.0000'}`, icon: '🏢', color: 'text-violet-600' },
    { label: 'Total Revenue (INR)', value: `₹${totals.revenue_inr?.toFixed(2) || '0.00'}`, icon: '₹', color: 'text-emerald-600' },
    { label: 'Impressions', value: totals.impressions.toLocaleString(), icon: '👁', color: 'text-ink-900' },
    { label: 'Clicks', value: totals.clicks.toLocaleString(), icon: '👆', color: 'text-ink-900' },
    { label: 'Network eCPM', value: `$${totals.cpm.toFixed(4)}`, icon: '📊', color: 'text-amber-600' },
    { label: 'Network CTR', value: `${totals.ctr}%`, icon: '📈', color: totals.ctr > 1 ? 'text-green-600' : 'text-amber-500' },
  ] : []

  const statCards = isPublisher ? publisherCards : adminCards

  return (
    <div className="space-y-5">
      {/* Header with date controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-green-600 font-medium">
            {isPublisher ? 'Your Ad Revenue' : 'Adsterra Network Revenue'}
          </span>
          {data?.period && (
            <span className="text-xs text-ink-400">· {data.period.startDate} → {data.period.endDate}</span>
          )}
          {isPublisher && data?.revenue_share_pct && (
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
              Your share: {data.revenue_share_pct}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Date mode toggle */}
          <div className="flex gap-1 p-0.5 bg-ink-100 rounded-lg">
            <button onClick={() => setDateMode('preset')}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${dateMode === 'preset' ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
              Preset
            </button>
            <button onClick={() => setDateMode('custom')}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${dateMode === 'custom' ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
              Custom
            </button>
          </div>

          {dateMode === 'preset' ? (
            <select className="input text-xs w-32" value={preset} onChange={e => setPreset(e.target.value)}>
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
              <option value="60">Last 60 days</option>
              <option value="90">Last 90 days</option>
            </select>
          ) : (
            <div className="flex items-center gap-1">
              <input type="date" className="input text-xs w-36" value={customStart}
                max={customEnd} onChange={e => setCustomStart(e.target.value)} />
              <span className="text-xs text-ink-400">→</span>
              <input type="date" className="input text-xs w-36" value={customEnd}
                min={customStart} max={today()} onChange={e => setCustomEnd(e.target.value)} />
              <button onClick={fetchData} className="text-xs px-3 py-1.5 bg-accent text-white rounded-lg hover:bg-accent/90">
                Apply
              </button>
            </div>
          )}

          <button onClick={fetchData} className="text-xs px-3 py-1.5 bg-ink-100 rounded-lg hover:bg-ink-200">
            ↻
          </button>

          {/* Export button */}
          <div className="relative">
            <button onClick={() => setShowExport(!showExport)}
              className="text-xs px-3 py-1.5 bg-ink-900 text-white rounded-lg hover:bg-ink-800 flex items-center gap-1">
              ⬇ Export
            </button>
            {showExport && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExport(false)} />
                <div className="absolute right-0 top-9 w-56 bg-white border border-ink-100 rounded-xl shadow-lg z-20 overflow-hidden">
                  <div className="p-2 space-y-1">
                    <button onClick={() => { exportCSV(); setShowExport(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-ink-700 hover:bg-ink-50 rounded-lg flex items-center gap-2">
                      📄 Download CSV
                    </button>
                    <button onClick={() => { exportExcel(); setShowExport(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-ink-700 hover:bg-ink-50 rounded-lg flex items-center gap-2">
                      📊 Download Excel (.xls)
                    </button>
                    <button onClick={() => { exportPDF(); setShowExport(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-ink-700 hover:bg-ink-50 rounded-lg flex items-center gap-2">
                      🖨 Print / Save as PDF
                    </button>
                    <div className="border-t border-ink-100 pt-2 mt-2">
                      <p className="text-xs text-ink-400 px-3 mb-1">Send via email</p>
                      <div className="px-3 pb-2 space-y-2">
                        <input type="email" className="input text-xs w-full" placeholder="email@example.com"
                          value={exportEmail} onChange={e => setExportEmail(e.target.value)} />
                        <button onClick={sendEmailReport} disabled={!exportEmail || sendingEmail}
                          className="w-full text-xs py-1.5 bg-accent text-white rounded-lg disabled:opacity-50">
                          {sendingEmail ? 'Sending...' : '📧 Send Report'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      {statCards.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(s => (
            <div key={s.label} className="card p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ink-400">{s.label}</span>
                <span>{s.icon}</span>
              </div>
              <div className={`text-xl font-display font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-ink-100 rounded-xl w-fit">
        <button onClick={() => setActiveTab('overview')}
          className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
          📊 Daily Chart
        </button>
        {isAdmin && (
          <button onClick={() => setActiveTab('domains')}
            className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${activeTab === 'domains' ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
            🌐 By Publisher Site
          </button>
        )}
      </div>

      {/* Chart */}
      {activeTab === 'overview' && (
        <div className="card p-5">
          <h3 className="font-semibold text-ink-900 mb-4">
            {isPublisher ? 'Your Earnings' : 'Network Revenue'} — {data?.period?.startDate} to {data?.period?.endDate}
          </h3>
          {chartData.length === 0 ? (
            <p className="text-center py-8 text-ink-300 text-sm">No data for this period</p>
          ) : (
            <>
              <div className="flex items-end gap-0.5 h-32 mb-2">
                {chartData.map((d, i) => {
                  const val = d.earnings ?? d.revenue ?? 0
                  return (
                    <div key={i} className="flex-1 group relative">
                      <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-ink-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        {d.date}<br/>{d.impressions} imp · {d.clicks} clicks · ${val.toFixed(4)}
                      </div>
                      <div className="w-full bg-green-400 hover:bg-green-500 rounded-t transition-colors"
                        style={{ height: `${Math.max(2, (val / maxVal) * 100)}%` }} />
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between text-xs text-ink-300">
                <span>{chartData[0]?.date}</span>
                <span>{chartData[chartData.length - 1]?.date}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Domain breakdown — admin only */}
      {activeTab === 'domains' && isAdmin && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-ink-100">
            <h3 className="font-semibold text-ink-900">Revenue by Publisher Site</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-ink-50 border-b border-ink-100">
                <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">Site / Domain</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Impressions</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Clicks</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">CTR</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">eCPM</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Gross</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Publisher</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Platform</th>
              </tr></thead>
              <tbody>
                {domains.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-ink-300 text-sm">No domain data</td></tr>
                )}
                {domains.map((d, i) => (
                  <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-ink-900">{d.site_name}</p>
                      <p className="text-xs text-ink-400">{d.domain}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-right">{d.impressions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-right">{d.clicks.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-right">{d.ctr}%</td>
                    <td className="px-4 py-3 text-xs text-right text-amber-600">${d.cpm.toFixed(4)}</td>
                    <td className="px-4 py-3 text-xs text-right font-medium">${d.gross_revenue.toFixed(4)}</td>
                    <td className="px-4 py-3 text-xs text-right font-medium text-green-600">
                      ${d.publisher_earnings.toFixed(4)}
                      <span className="text-ink-400 font-normal ml-1">({d.revenue_share_pct}%)</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-right font-medium text-violet-600">${d.platform_earnings.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
