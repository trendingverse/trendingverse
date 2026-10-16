'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function PayoutsPage() {
  const [diag, setDiag] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<any>(null)
  const [range, setRange] = useState({
    start: new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  })

  async function loadDiag() {
    setLoading(true); setDiag(null)
    const res = await fetch('/api/mediation/payouts/diagnostic')
    if (res.ok) setDiag(await res.json())
    else toast.error('Failed to load diagnostic')
    setLoading(false)
  }

  async function runPayouts() {
    setRunning(true); setRunResult(null)
    const res = await fetch('/api/mediation/payouts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(range),
    })
    const d = await res.json()
    setRunResult(d)
    if (d.ok) toast.success(`Generated ${d.generated} rows, skipped ${d.skipped}`)
    else toast.error(d.error || 'Failed')
    setRunning(false)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">Payout Engine</h1>
        <p className="text-sm text-ink-400 mt-1">Run payouts and diagnose site-URL matching issues.</p>
      </div>

      {/* Run payouts */}
      <div className="card p-5 space-y-4">
        <p className="font-semibold text-ink-900">▶ Run Payout Generation</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start Date</label>
            <input type="date" className="input" value={range.start} onChange={e => setRange(r => ({ ...r, start: e.target.value }))} />
          </div>
          <div>
            <label className="label">End Date</label>
            <input type="date" className="input" value={range.end} onChange={e => setRange(r => ({ ...r, end: e.target.value }))} />
          </div>
        </div>
        <button onClick={runPayouts} disabled={running} className="btn-primary py-2 disabled:opacity-50">
          {running ? 'Running…' : '⚡ Generate Payouts'}
        </button>
        {runResult && (
          <pre className={`text-xs p-3 rounded-xl ${runResult.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {JSON.stringify(runResult, null, 2)}
          </pre>
        )}
      </div>

      {/* Diagnostic */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-ink-900">🔍 Site-URL Matching Diagnostic</p>
          <button onClick={loadDiag} disabled={loading} className="text-xs px-3 py-1.5 bg-ink-100 text-ink-600 rounded-xl hover:bg-ink-200 disabled:opacity-50">
            {loading ? 'Loading…' : '↺ Run Diagnostic'}
          </button>
        </div>

        {diag && (
          <div className="space-y-5">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { l: 'Revenue Rows', v: diag.summary.partner_revenue_rows },
                { l: 'Distinct URLs', v: diag.summary.distinct_site_urls },
                { l: 'Matched', v: diag.summary.matched_urls, c: 'text-green-600' },
                { l: 'Unmatched', v: diag.summary.unmatched_urls, c: diag.summary.unmatched_urls > 0 ? 'text-red-600' : 'text-ink-400' },
                { l: 'Reports Written', v: diag.summary.revenue_report_rows_written, c: 'text-blue-600' },
              ].map(s => (
                <div key={s.l} className="bg-ink-50 rounded-xl p-3 text-center">
                  <div className={`text-xl font-bold ${s.c || 'text-ink-900'}`}>{s.v}</div>
                  <div className="text-[10px] text-ink-400 mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>

            {/* Sites in DB */}
            <div>
              <p className="text-xs font-semibold text-ink-600 mb-2 uppercase tracking-wide">Sites in DB</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-ink-100">
                    {['site_url','normalised','user_id','share_pct'].map(h => <th key={h} className="px-3 py-2 text-left text-ink-500 font-medium">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {diag.sites_in_db.map((s: any) => (
                      <tr key={s.id} className="border-b border-ink-50">
                        <td className="px-3 py-2 text-ink-700">{s.site_url}</td>
                        <td className="px-3 py-2 font-mono text-ink-500">{s.normalised}</td>
                        <td className="px-3 py-2 text-ink-400 truncate max-w-[120px]">{s.user_id}</td>
                        <td className="px-3 py-2 font-semibold text-green-600">{s.share_pct != null ? `${s.share_pct}%` : <span className="text-amber-500">⚠ none</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Unmatched URLs */}
            {diag.unmatched_revenue_urls.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-600 mb-2 uppercase tracking-wide">⚠ Unmatched Revenue URLs (skipped in payouts)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-red-100">
                      {['raw_url','normalised','rows','total_usd','partners'].map(h => <th key={h} className="px-3 py-2 text-left text-ink-500 font-medium">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {diag.unmatched_revenue_urls.map((u: any) => (
                        <tr key={u.normalised} className="border-b border-ink-50 bg-red-50/30">
                          <td className="px-3 py-2 text-red-700">{u.raw_url}</td>
                          <td className="px-3 py-2 font-mono text-ink-500">{u.normalised}</td>
                          <td className="px-3 py-2">{u.rows}</td>
                          <td className="px-3 py-2 font-medium">${u.total_usd}</td>
                          <td className="px-3 py-2 text-ink-400">{u.partners.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-red-500 mt-2">
                  These site URLs exist in partner_revenue but have no matching row in the <code>sites</code> table.
                  Add them at <strong>/admin/monetization</strong> or update the site_url there to match the above normalised form.
                </p>
              </div>
            )}

            {/* Matched URLs */}
            {diag.matched_revenue_urls.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-700 mb-2 uppercase tracking-wide">✓ Matched Revenue URLs</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-green-100">
                      {['normalised','rows','total_usd','partners'].map(h => <th key={h} className="px-3 py-2 text-left text-ink-500 font-medium">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {diag.matched_revenue_urls.map((u: any) => (
                        <tr key={u.normalised} className="border-b border-ink-50">
                          <td className="px-3 py-2 font-mono text-green-700">{u.normalised}</td>
                          <td className="px-3 py-2">{u.rows}</td>
                          <td className="px-3 py-2 font-medium">${u.total_usd}</td>
                          <td className="px-3 py-2 text-ink-400">{u.partners.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent report rows */}
            {diag.recent_revenue_reports.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-ink-600 mb-2 uppercase tracking-wide">Recent revenue_reports rows</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-ink-100">
                      {['site_id','report_date','revenue_usd','publisher_earnings_usd'].map(h => <th key={h} className="px-3 py-2 text-left text-ink-500 font-medium">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {diag.recent_revenue_reports.map((r: any, i: number) => (
                        <tr key={i} className="border-b border-ink-50">
                          <td className="px-3 py-2 font-mono text-ink-400 truncate max-w-[140px]">{r.site_id}</td>
                          <td className="px-3 py-2">{r.report_date}</td>
                          <td className="px-3 py-2 text-blue-600">${Number(r.revenue_usd || 0).toFixed(4)}</td>
                          <td className="px-3 py-2 text-green-600">${Number(r.publisher_earnings_usd || 0).toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
