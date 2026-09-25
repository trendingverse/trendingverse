'use client'
// app/(admin)/admin/ad-reports/page.tsx
import { useEffect, useMemo, useState } from 'react'

const card: any = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }
const input: any = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--txt)', fontSize: 13 }
const btn: any = { padding: '8px 14px', borderRadius: 8, border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }

const ymd = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
function presetRange(p: string): [string, string] {
  const now = new Date()
  const today = ymd(now)
  const back = (n: number) => ymd(new Date(now.getTime() - n * 86400000))
  if (p === 'today') return [today, today]
  if (p === 'yesterday') return [back(1), back(1)]
  if (p === '30d') return [back(29), today]
  if (p === 'month') return [ymd(new Date(now.getFullYear(), now.getMonth(), 1)), today]
  if (p === 'lastmonth') return [ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), ymd(new Date(now.getFullYear(), now.getMonth(), 0))]
  return [back(6), today]
}
const pct = (a: number, b: number) => (b > 0 ? ((a * 100) / b).toFixed(2) + '%' : '—')
const num = (n: number) => n.toLocaleString('en-IN')

type Agg = { k: string; label: string; s: number; v: number; c: number }
function group(rows: any[], keyFn: (r: any) => string, labelFn: (k: string) => string): Agg[] {
  const m = new Map<string, Agg>()
  for (const r of rows) {
    const k = keyFn(r)
    if (!m.has(k)) m.set(k, { k, label: labelFn(k), s: 0, v: 0, c: 0 })
    const a = m.get(k)!
    a.s += Number(r.s) || 0
    a.v += Number(r.v) || 0
    a.c += Number(r.c) || 0
  }
  return Array.from(m.values())
}

function Table({ title, head, rows }: { title: string; head: string; rows: Agg[] }) {
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <p style={{ fontSize: 14, fontWeight: 800, margin: 0, padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>{title}</p>
      {rows.length === 0 ? <p style={{ padding: 20, margin: 0, fontSize: 13, color: 'var(--txt-3)' }}>No data for this period.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--txt-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {[head, 'Impressions', 'Viewable', 'Viewability', 'Clicks', 'CTR'].map(h => <th key={h} style={{ padding: '10px 20px', fontWeight: 700 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.k} style={{ borderTop: '1px solid var(--border-dim, var(--border))' }}>
                  <td style={{ padding: '10px 20px', fontWeight: 600 }}>{r.label}</td>
                  <td style={{ padding: '10px 20px' }}>{num(r.s)}</td>
                  <td style={{ padding: '10px 20px' }}>{num(r.v)}</td>
                  <td style={{ padding: '10px 20px' }}>{pct(r.v, r.s)}</td>
                  <td style={{ padding: '10px 20px' }}>{num(r.c)}</td>
                  <td style={{ padding: '10px 20px' }}>{pct(r.c, r.s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function AdReportsPage() {
  const [sites, setSites] = useState<any[]>([])
  const [siteId, setSiteId] = useState('')
  const [preset, setPreset] = useState('7d')
  const [range, setRange] = useState<[string, string]>(presetRange('7d'))
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tvads/report', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        if (!j.ok) throw new Error(j.error)
        setSites(j.sites || [])
        if (j.sites?.[0]) setSiteId(j.sites[0].id)
        else setLoading(false)
      })
      .catch(e => { setErr(e.message || 'Failed to load'); setLoading(false) })
  }, [])

  useEffect(() => {
    if (!siteId) return
    setLoading(true)
    fetch(`/api/tvads/report?site=${siteId}&from=${range[0]}&to=${range[1]}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!j.ok) throw new Error(j.error); setData(j); setErr('') })
      .catch(e => setErr(e.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [siteId, range])

  const rows: any[] = data?.rows || []
  const names: Record<string, string> = data?.names || {}
  const tot = useMemo(() => group(rows, () => 'all', () => 'All')[0] || { s: 0, v: 0, c: 0 }, [rows])
  const byKind = useMemo(() => group(rows, r => (r.src === 'n' ? 'Network' : 'Direct'), k => k), [rows])
  const byUnitSrc = useMemo(() => group(rows, r => `${r.u}|${r.src}`, k => { const [u, s] = k.split('|'); return `${names[u] || u} — ${names[s] || s}` }), [rows, names])
  const byDev = useMemo(() => group(rows, r => r.dev, k => k.charAt(0).toUpperCase() + k.slice(1)), [rows])
  const byDay = useMemo(() => group(rows, r => r.d, k => k).sort((a, b) => (a.k < b.k ? 1 : -1)), [rows])

  const kpi = (l: string, v: string) => (
    <div style={card}>
      <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--txt-3)', margin: 0 }}>{l}</p>
      <p style={{ fontSize: 26, fontWeight: 900, margin: '6px 0 0' }}>{v}</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40, color: 'var(--txt)' }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Ad Reports</h1>
        <p style={{ fontSize: 12, color: 'var(--txt-3)', marginTop: 4 }}>Ad delivery on your site: impressions, viewability and clicks.</p>
      </div>

      {err && <div style={{ ...card, padding: 12, borderColor: '#f87171', color: '#f87171', fontSize: 13 }}>{err}</div>}
      {!loading && !err && sites.length === 0 && <div style={card}>No sites are linked to your account yet.</div>}

      {sites.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {sites.length > 1 && (
            <select style={input} value={siteId} onChange={e => setSiteId(e.target.value)}>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <select style={input} value={preset} onChange={e => { setPreset(e.target.value); if (e.target.value !== 'custom') setRange(presetRange(e.target.value)) }}>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="month">This month</option>
            <option value="lastmonth">Last month</option>
            <option value="custom">Custom…</option>
          </select>
          {preset === 'custom' && (
            <>
              <input type="date" style={input} value={range[0]} onChange={e => setRange([e.target.value, range[1]])} />
              <span style={{ color: 'var(--txt-3)' }}>to</span>
              <input type="date" style={input} value={range[1]} onChange={e => setRange([range[0], e.target.value])} />
            </>
          )}
          {siteId && <a style={btn} href={`/api/tvads/report?site=${siteId}&from=${range[0]}&to=${range[1]}&format=csv`}>Download CSV</a>}
          {loading && <span style={{ fontSize: 12, color: 'var(--txt-3)' }}>Loading…</span>}
        </div>
      )}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
            {kpi('Impressions', num(tot.s))}
            {kpi('Viewable', num(tot.v))}
            {kpi('Viewability', pct(tot.v, tot.s))}
            {kpi('Clicks', num(tot.c))}
            {kpi('CTR', pct(tot.c, tot.s))}
          </div>
          <Table title="Network vs Direct" head="Type" rows={byKind} />
          <Table title="By ad unit & source" head="Ad unit — Source" rows={byUnitSrc} />
          <Table title="By device" head="Device" rows={byDev} />
          <Table title="By day" head="Date" rows={byDay} />
          <p style={{ fontSize: 11, color: 'var(--txt-3)' }}>
            Impressions = ad rendered on page. Viewable = at least 50% on screen for 1 second. Clicks on network ads are measured in the browser and are indicative.
          </p>
        </>
      )}
    </div>
  )
}
