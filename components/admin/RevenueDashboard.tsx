'use client'
import { useState, useEffect } from 'react'

// Overall network revenue dashboard with partner + site + date filters,
// plus a "Sync now" button that pulls fresh revenue from partner APIs.
interface Group { key: string; revenue: number; impressions: number; clicks: number }

export function RevenueDashboard() {
  const today = new Date().toISOString().split('T')[0]
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0]

  const [start, setStart] = useState(monthAgo)
  const [end, setEnd] = useState(today)
  const [partner, setPartner] = useState('')
  const [site, setSite] = useState('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ start, end })
      if (partner) params.set('partner', partner)
      if (site) params.set('site', site)
      const r = await fetch('/api/mediation/revenue?' + params.toString())
      setData(await r.json())
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function syncNow() {
    setSyncing(true); setMsg('')
    try {
      const r = await fetch('/api/mediation/revenue/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, end }),
      })
      const d = await r.json()
      if (d.ok) {
        const total = (d.results || []).reduce((s: number, x: any) => s + (x.rows || 0), 0)
        setMsg(`Synced ${total} rows from ${(d.results || []).length} network(s).`)
        await load()
      } else { setMsg(d.error || 'Sync failed') }
    } catch { setMsg('Sync failed') }
    finally { setSyncing(false) }
  }

  const money = (v: number) => '$' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  const int = (v: number) => (v || 0).toLocaleString('en-IN')

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="card p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-400 mb-1">From</label>
          <input type="date" value={start} onChange={e => setStart(e.target.value)} className="border border-ink-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-400 mb-1">To</label>
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="border border-ink-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-400 mb-1">Partner</label>
          <input type="text" value={partner} onChange={e => setPartner(e.target.value)} placeholder="all" className="border border-ink-200 rounded-lg px-3 py-2 text-sm w-32" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-400 mb-1">Site</label>
          <input type="text" value={site} onChange={e => setSite(e.target.value)} placeholder="all" className="border border-ink-200 rounded-lg px-3 py-2 text-sm w-40" />
        </div>
        <button onClick={load} disabled={loading} className="btn-primary px-5 py-2.5 disabled:opacity-50">{loading ? 'Loading…' : 'Apply'}</button>
        <button onClick={syncNow} disabled={syncing}
          className="px-5 py-2.5 rounded-lg border border-ink-300 text-ink-700 hover:bg-surface-2 text-sm font-medium disabled:opacity-50">
          {syncing ? 'Syncing…' : '↻ Sync now'}
        </button>
      </div>
      {msg && <div className="card p-3 text-sm text-ink-600">{msg}</div>}

      {data && !data.error && (
        <>
          {/* Totals */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-5">
              <p className="text-xs uppercase tracking-wide text-ink-400 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-green-600">{money(data.total?.revenue)}</p>
            </div>
            <div className="card p-5">
              <p className="text-xs uppercase tracking-wide text-ink-400 mb-1">Impressions</p>
              <p className="text-2xl font-bold text-ink-900">{int(data.total?.impressions)}</p>
            </div>
            <div className="card p-5">
              <p className="text-xs uppercase tracking-wide text-ink-400 mb-1">Clicks</p>
              <p className="text-2xl font-bold text-ink-900">{int(data.total?.clicks)}</p>
            </div>
          </div>

          {/* By partner */}
          <GroupTable title="By Network" rows={data.by_partner} money={money} int={int} />
          {/* By site */}
          <GroupTable title="By Site" rows={data.by_site} money={money} int={int} />
          {/* By day */}
          <GroupTable title="By Day" rows={data.by_day} money={money} int={int} />
        </>
      )}
      {data?.error && <div className="card p-4 text-sm text-red-600">{data.error}</div>}
      {data && !data.error && (data.total?.impressions === 0) && (
        <div className="card p-6 text-center text-sm text-ink-400">
          No revenue data for this range yet. Configure a network's reporting API and hit "Sync now".
        </div>
      )}
    </div>
  )
}

function GroupTable({ title, rows, money, int }: any) {
  if (!rows?.length) return null
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-ink-100"><p className="text-sm font-semibold text-ink-700">{title}</p></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2 text-ink-500 text-left">
              <th className="px-4 py-2 font-semibold">{title.replace('By ', '')}</th>
              <th className="px-4 py-2 font-semibold text-right">Revenue</th>
              <th className="px-4 py-2 font-semibold text-right">Impressions</th>
              <th className="px-4 py-2 font-semibold text-right">Clicks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: Group) => (
              <tr key={r.key} className="border-t border-ink-50">
                <td className="px-4 py-2.5 text-ink-800">{r.key}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-green-700 font-medium">{money(r.revenue)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{int(r.impressions)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{int(r.clicks)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
