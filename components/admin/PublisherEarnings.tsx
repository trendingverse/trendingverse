'use client'
import { useState, useEffect } from 'react'

// Publisher-facing earnings. Shows ONLY their own payout (their share),
// by site and by day. No partner names, no gross revenue, no margin.
export function PublisherEarnings() {
  const today = new Date().toISOString().split('T')[0]
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0]
  const [start, setStart] = useState(monthAgo)
  const [end, setEnd] = useState(today)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`/api/publisher/earnings?start=${start}&end=${end}`)
      setData(await r.json())
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const inr = (v: number) => '₹' + (v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const usd = (v: number) => '$' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const int = (v: number) => (v || 0).toLocaleString('en-IN')

  return (
    <div className="space-y-6">
      <div className="card p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-400 mb-1">From</label>
          <input type="date" value={start} onChange={e => setStart(e.target.value)} className="border border-ink-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-400 mb-1">To</label>
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="border border-ink-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button onClick={load} disabled={loading} className="btn-primary px-5 py-2.5 disabled:opacity-50">{loading ? 'Loading…' : 'Apply'}</button>
      </div>

      {data && !data.error && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5">
              <p className="text-xs uppercase tracking-wide text-ink-400 mb-1">Your Earnings</p>
              <p className="text-2xl font-bold text-green-600">{inr(data.total?.earnings_inr)}</p>
              <p className="text-xs text-ink-400 mt-1">{usd(data.total?.earnings_usd)}</p>
            </div>
            <div className="card p-5">
              <p className="text-xs uppercase tracking-wide text-ink-400 mb-1">Impressions</p>
              <p className="text-2xl font-bold text-ink-900">{int(data.total?.impressions)}</p>
            </div>
            <div className="card p-5">
              <p className="text-xs uppercase tracking-wide text-ink-400 mb-1">Clicks</p>
              <p className="text-2xl font-bold text-ink-900">{int(data.total?.clicks)}</p>
            </div>
            <div className="card p-5">
              <p className="text-xs uppercase tracking-wide text-ink-400 mb-1">Sites</p>
              <p className="text-2xl font-bold text-ink-900">{data.by_site?.length || 0}</p>
            </div>
          </div>

          {data.by_site?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-ink-100"><p className="text-sm font-semibold text-ink-700">By Site</p></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-2 text-ink-500 text-left">
                      <th className="px-4 py-2 font-semibold">Site</th>
                      <th className="px-4 py-2 font-semibold text-right">Earnings</th>
                      <th className="px-4 py-2 font-semibold text-right">Impressions</th>
                      <th className="px-4 py-2 font-semibold text-right">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_site.map((r: any) => (
                      <tr key={r.key} className="border-t border-ink-50">
                        <td className="px-4 py-2.5 text-ink-800">{r.key}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-green-700 font-medium">{inr(r.earnings_inr)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{int(r.impressions)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{int(r.clicks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.by_day?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-ink-100"><p className="text-sm font-semibold text-ink-700">Daily</p></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-2 text-ink-500 text-left">
                      <th className="px-4 py-2 font-semibold">Date</th>
                      <th className="px-4 py-2 font-semibold text-right">Earnings</th>
                      <th className="px-4 py-2 font-semibold text-right">Impressions</th>
                      <th className="px-4 py-2 font-semibold text-right">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_day.map((r: any) => (
                      <tr key={r.key} className="border-t border-ink-50">
                        <td className="px-4 py-2.5 text-ink-800">{r.key}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-green-700 font-medium">{inr(r.earnings_inr)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{int(r.impressions)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{int(r.clicks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(!data.by_site?.length) && (
            <div className="card p-8 text-center text-sm text-ink-400">
              No earnings recorded for this period yet. Earnings appear once your ads have served and been reconciled (usually within a day).
            </div>
          )}
        </>
      )}
      {data?.error && <div className="card p-4 text-sm text-red-600">{data.error}</div>}
    </div>
  )
}
