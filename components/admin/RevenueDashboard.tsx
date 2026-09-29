'use client'
// components/admin/RevenueDashboard.tsx — v2 (admin)
// All networks: API-synced + manually added. Filters, USD/INR, eCPM,
// by network / site / day, "Sync now", and "Add revenue" (form or CSV paste).
import { useState, useEffect } from 'react'

interface Group { key: string; revenue: number; revenue_inr: number; impressions: number; clicks: number; ecpm: number; ecpm_inr: number }

export function RevenueDashboard() {
  const today = new Date().toISOString().split('T')[0]
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().split('T')[0]

  const [start, setStart] = useState(monthAgo)
  const [end, setEnd] = useState(today)
  const [partner, setPartner] = useState('')
  const [site, setSite] = useState('')
  const [cur, setCur] = useState<'USD' | 'INR'>('INR')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState('')
  const [showAdd, setShowAdd] = useState(false)

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
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function syncNow() {
    setSyncing(true); setMsg('')
    try {
      const r = await fetch('/api/mediation/revenue/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, end }),
      })
      const d = await r.json()
      if (d.ok) {
        const ok = (d.results || []).filter((x: any) => x.ok)
        const bad = (d.results || []).filter((x: any) => !x.ok)
        const rows = ok.reduce((s: number, x: any) => s + (x.rows || 0), 0)
        setMsg(`Synced ${rows} rows from ${ok.length} network(s).` + (bad.length ? ` Failed: ${bad.map((b: any) => b.partner).join(', ')}.` : ''))
        await load()
      } else { setMsg(d.error || 'Sync failed') }
    } catch { setMsg('Sync failed') }
    finally { setSyncing(false) }
  }

  const money = (usd: number, inr: number) =>
    cur === 'INR'
      ? '₹' + (inr || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '$' + (usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
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
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-400 mb-1">Network</label>
          <select value={partner} onChange={e => setPartner(e.target.value)} className="border border-ink-200 rounded-lg px-3 py-2 text-sm w-40">
            <option value="">All networks</option>
            {(data?.partners || []).map((p: any) => <option key={p.id} value={p.slug}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-400 mb-1">Site</label>
          <select value={site} onChange={e => setSite(e.target.value)} className="border border-ink-200 rounded-lg px-3 py-2 text-sm w-44">
            <option value="">All sites</option>
            {(data?.sites || []).map((s: any) => <option key={s.id} value={s.host}>{s.host}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-400 mb-1">Currency</label>
          <div className="flex rounded-lg border border-ink-200 overflow-hidden text-sm">
            {(['INR', 'USD'] as const).map(c => (
              <button key={c} onClick={() => setCur(c)} className={`px-3 py-2 ${cur === c ? 'bg-ink-900 text-white' : 'text-ink-600'}`}>{c}</button>
            ))}
          </div>
        </div>
        <button onClick={load} disabled={loading} className="btn-primary px-5 py-2.5 disabled:opacity-50">{loading ? 'Loading…' : 'Apply'}</button>
        <button onClick={syncNow} disabled={syncing}
          className="px-5 py-2.5 rounded-lg border border-ink-300 text-ink-700 hover:bg-surface-2 text-sm font-medium disabled:opacity-50">
          {syncing ? 'Syncing…' : '↻ Sync now'}
        </button>
        <button onClick={() => setShowAdd(!showAdd)}
          className="px-5 py-2.5 rounded-lg border border-ink-300 text-ink-700 hover:bg-surface-2 text-sm font-medium">
          + Add revenue
        </button>
      </div>
      {msg && <div className="card p-3 text-sm text-ink-600">{msg}</div>}

      {showAdd && data?.partners && (
        <AddRevenue partners={data.partners} sites={data.sites || []} onSaved={(m: string) => { setMsg(m); setShowAdd(false); load() }} />
      )}

      {data && !data.error && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi label="Total Revenue" value={money(data.total?.revenue, data.total?.revenue_inr)} green />
            <Kpi label="Impressions" value={int(data.total?.impressions)} />
            <Kpi label="Clicks" value={int(data.total?.clicks)} />
            <Kpi label="eCPM" value={money(data.total?.ecpm, data.total?.ecpm_inr)} />
          </div>
          <GroupTable title="By Network" head="Network" rows={data.by_partner} money={money} int={int} />
          <GroupTable title="By Site" head="Site" rows={data.by_site} money={money} int={int} />
          <GroupTable title="By Day" head="Day" rows={data.by_day} money={money} int={int} />
          <p className="text-xs text-ink-400">
            INR at ₹{Number(data.usd_inr || 0).toFixed(2)} per USD. Networks with a reporting API sync daily; add others with “+ Add revenue”.
          </p>
        </>
      )}
      {data?.error && <div className="card p-4 text-sm text-red-600">{data.error}</div>}
      {data && !data.error && (data.total?.impressions === 0 && data.total?.revenue === 0) && (
        <div className="card p-6 text-center text-sm text-ink-400">
          No revenue for this range yet. Click “Sync now” for API-connected networks, or “+ Add revenue” for the others.
        </div>
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

function GroupTable({ title, head, rows, money, int }: any) {
  if (!rows?.length) return null
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-ink-100"><p className="text-sm font-semibold text-ink-700">{title}</p></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2 text-ink-500 text-left">
              <th className="px-4 py-2 font-semibold">{head}</th>
              <th className="px-4 py-2 font-semibold text-right">Revenue</th>
              <th className="px-4 py-2 font-semibold text-right">Impressions</th>
              <th className="px-4 py-2 font-semibold text-right">Clicks</th>
              <th className="px-4 py-2 font-semibold text-right">eCPM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: Group) => (
              <tr key={r.key} className="border-t border-ink-50">
                <td className="px-4 py-2.5 text-ink-800">{r.key}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-green-700 font-medium">{money(r.revenue, r.revenue_inr)}</td>
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

// ── Add revenue: single row or CSV paste ──────────────────────────
function AddRevenue({ partners, sites, onSaved }: { partners: any[]; sites: any[]; onSaved: (m: string) => void }) {
  const [mode, setMode] = useState<'form' | 'csv'>('form')
  const [f, setF] = useState({ partner_id: partners[0]?.id || '', site: sites[0]?.host || '', date: new Date(Date.now() - 864e5).toISOString().split('T')[0], impressions: '', clicks: '', revenue: '', currency: 'USD' })
  const [csv, setCsv] = useState('')
  const [csvPartner, setCsvPartner] = useState(partners[0]?.id || '')
  const [csvCur, setCsvCur] = useState('USD')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(entries: any[]) {
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/mediation/revenue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries }) })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || 'Save failed'); return }
      onSaved(`Saved ${d.saved} revenue row(s).`)
    } finally { setBusy(false) }
  }

  function parseCsv() {
    const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const rows = lines.filter(l => !/^date\b/i.test(l)).map(l => {
      const [date, site, impressions, clicks, revenue] = l.split(/[,\t;]/).map(s => s.trim())
      return { partner_id: csvPartner, date, site, impressions, clicks, revenue: String(revenue || '').replace(/[$₹,\s]/g, ''), currency: csvCur }
    })
    if (!rows.length) { setErr('Paste at least one row'); return }
    save(rows)
  }

  const inp = 'border border-ink-200 rounded-lg px-3 py-2 text-sm w-full'
  const lab = 'block text-xs font-semibold uppercase tracking-wide text-ink-400 mb-1'
  return (
    <div className="card p-5 space-y-4 border-2 border-accent/20">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-ink-900">Add revenue for a network without a reporting API</p>
        <div className="flex rounded-lg border border-ink-200 overflow-hidden text-sm">
          <button onClick={() => setMode('form')} className={`px-3 py-1.5 ${mode === 'form' ? 'bg-ink-900 text-white' : 'text-ink-600'}`}>One day</button>
          <button onClick={() => setMode('csv')} className={`px-3 py-1.5 ${mode === 'csv' ? 'bg-ink-900 text-white' : 'text-ink-600'}`}>Paste CSV</button>
        </div>
      </div>
      {mode === 'form' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className={lab}>Network</label>
            <select className={inp} value={f.partner_id} onChange={e => setF({ ...f, partner_id: e.target.value })}>
              {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></div>
          <div><label className={lab}>Site</label>
            <input className={inp} list="rev-sites" value={f.site} onChange={e => setF({ ...f, site: e.target.value })} placeholder="kannadadunia.com" />
            <datalist id="rev-sites">{sites.map(s => <option key={s.id} value={s.host} />)}</datalist></div>
          <div><label className={lab}>Date</label><input type="date" className={inp} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></div>
          <div><label className={lab}>Currency</label>
            <select className={inp} value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })}><option>USD</option><option>INR</option></select></div>
          <div><label className={lab}>Impressions</label><input type="number" className={inp} value={f.impressions} onChange={e => setF({ ...f, impressions: e.target.value })} /></div>
          <div><label className={lab}>Clicks</label><input type="number" className={inp} value={f.clicks} onChange={e => setF({ ...f, clicks: e.target.value })} /></div>
          <div><label className={lab}>Revenue</label><input type="number" step="0.0001" className={inp} value={f.revenue} onChange={e => setF({ ...f, revenue: e.target.value })} /></div>
          <div className="flex items-end"><button disabled={busy} onClick={() => save([f])} className="btn-primary px-5 py-2.5 w-full disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button></div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className={lab}>Network</label>
              <select className={inp} value={csvPartner} onChange={e => setCsvPartner(e.target.value)}>
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
            <div><label className={lab}>Currency</label>
              <select className={inp} value={csvCur} onChange={e => setCsvCur(e.target.value)}><option>USD</option><option>INR</option></select></div>
          </div>
          <div>
            <label className={lab}>Rows: date, site, impressions, clicks, revenue</label>
            <textarea className={inp + ' font-mono text-xs'} rows={6} value={csv} onChange={e => setCsv(e.target.value)}
              placeholder={'2026-09-20, kannadadunia.com, 12500, 40, 1.85\n2026-09-21, kannadadunia.com, 13100, 38, 1.92'} />
          </div>
          <button disabled={busy} onClick={parseCsv} className="btn-primary px-5 py-2.5 disabled:opacity-50">{busy ? 'Saving…' : 'Save rows'}</button>
        </div>
      )}
      <p className="text-xs text-ink-400">Saving the same network + site + date again replaces that day’s figures.</p>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  )
}
