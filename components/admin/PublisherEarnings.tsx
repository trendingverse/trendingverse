'use client'
// components/admin/PublisherEarnings.tsx
// Publisher view of Earnings: only their sites, only their share,
// no ad network names. CSV download.
import { useState, useEffect } from 'react'

export function PublisherEarnings() {
  const today = new Date().toISOString().split('T')[0]
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0]
  const [start, setStart] = useState(monthAgo)
  const [end, setEnd] = useState(today)
  const [cur, setCur] = useState<'INR' | 'USD'>('INR')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/mediation/revenue?' + new URLSearchParams({ start, end }).toString())
      setData(await r.json())
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const money = (usd: number, inr: number) =>
    cur === 'INR'
      ? '₹' + (inr || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '$' + (usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  const int = (v: number) => (v || 0).toLocaleString('en-IN')

  function downloadCsv() {
    if (!data?.by_day) return
    const lines = ['Date,Impressions,Clicks,eCPM (INR),Earnings (INR),Earnings (USD)']
    for (const r of data.by_day) lines.push([r.key, r.impressions, r.clicks, r.ecpm_inr, r.earnings_inr, r.earnings].join(','))
    lines.push(['Total', data.total.impressions, data.total.clicks, data.total.ecpm_inr, data.total.earnings_inr, data.total.earnings].join(','))
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `earnings_${start}_to_${end}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (data?.locked) {
    return (
      <div className="card p-8 text-center max-w-lg mx-auto">
        <div className="text-5xl mb-4">💰</div>
        <h2 className="font-bold text-ink-900 text-xl mb-2">Upgrade to see your ad earnings</h2>
        <p className="text-ink-500 text-sm mb-6 leading-relaxed">
          Your current package ({data.plan}) doesn’t include ad monetization. Upgrade to earn from ads on your site and track your earnings here.
        </p>
        <a href="/pricing" className="inline-block bg-red-500 text-white font-semibold px-6 py-3 rounded-xl hover:bg-red-600 transition-colors">
          View packages →
        </a>
      </div>
    )
  }

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
        <div className="flex rounded-lg border border-ink-200 overflow-hidden text-sm">
          {(['INR', 'USD'] as const).map(c => (
            <button key={c} onClick={() => setCur(c)} className={`px-3 py-2 ${cur === c ? 'bg-ink-900 text-white' : 'text-ink-600'}`}>{c}</button>
          ))}
        </div>
        <button onClick={load} disabled={loading} className="btn-primary px-5 py-2.5 disabled:opacity-50">{loading ? 'Loading…' : 'Apply'}</button>
        <button onClick={downloadCsv} disabled={!data?.by_day?.length}
          className="px-5 py-2.5 rounded-lg border border-ink-300 text-ink-700 hover:bg-surface-2 text-sm font-medium disabled:opacity-50">
          ⬇ Download CSV
        </button>
      </div>

      {data?.error && <div className="card p-4 text-sm text-red-600">{data.error}</div>}

      {data && !data.error && (
        <>
          {data.sites?.length ? (
            <p className="text-sm text-ink-500">
              Your sites: {data.sites.map((s: any) => `${s.host} (${s.share_pct}% share)`).join(' · ')}
            </p>
          ) : (
            <div className="card p-6 text-center text-sm text-ink-400">No sites are linked to your account yet. Please contact TrendingVerse.</div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="Your Earnings" value={money(data.total?.earnings, data.total?.earnings_inr)} green />
            <Kpi label="Impressions" value={int(data.total?.impressions)} />
            <Kpi label="Clicks" value={int(data.total?.clicks)} />
            <Kpi label="eCPM" value={money(data.total?.ecpm, data.total?.ecpm_inr)} />
          </div>
          {data.sites?.length > 1 && <Table title="By Site" head="Site" rows={data.by_site} money={money} int={int} />}
          <Table title="By Day" head="Date" rows={data.by_day} money={money} int={int} />
          <p className="text-xs text-ink-400">Earnings are shown after your revenue share. Recent days may update as ad partners finalise their reports.</p>
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-wide text-ink-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${green ? 'text-green-600' : 'text-ink-900'}`}>{value}</p>
    </div>
  )
}

function Table({ title, head, rows, money, int }: any) {
  if (!rows?.length) return <div className="card p-6 text-center text-sm text-ink-400">No earnings in this date range yet.</div>
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-ink-100"><p className="text-sm font-semibold text-ink-700">{title}</p></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2 text-ink-500 text-left">
              <th className="px-4 py-2 font-semibold">{head}</th>
              <th className="px-4 py-2 font-semibold text-right">Earnings</th>
              <th className="px-4 py-2 font-semibold text-right">Impressions</th>
              <th className="px-4 py-2 font-semibold text-right">Clicks</th>
              <th className="px-4 py-2 font-semibold text-right">eCPM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.key} className="border-t border-ink-50">
                <td className="px-4 py-2.5 text-ink-800">{r.key}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-green-700 font-medium">{money(r.earnings, r.earnings_inr)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{int(r.impressions)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{int(r.clicks)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{money(r.ecpm, r.ecpm_inr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
