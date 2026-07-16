'use client'
import { useState } from 'react'

// GAM-style report builder: pick metrics + dimensions, set date range +
// filters, run the report, get a sortable table with totals and CSV export.
const ALL_DIMENSIONS = [
  { key: 'date', label: 'Date' },
  { key: 'site', label: 'Site' },
  { key: 'partner', label: 'Demand Partner' },
  { key: 'position', label: 'Ad Position' },
  { key: 'country', label: 'Country' },
  { key: 'device', label: 'Device' },
]
const ALL_METRICS = [
  { key: 'requests', label: 'Requests', fmt: 'int' },
  { key: 'fills', label: 'Fills', fmt: 'int' },
  { key: 'nofills', label: 'No-fills', fmt: 'int' },
  { key: 'fill_rate', label: 'Fill Rate', fmt: 'pct' },
  { key: 'clicks', label: 'Clicks', fmt: 'int' },
  { key: 'ctr', label: 'CTR', fmt: 'pct' },
  { key: 'viewable', label: 'Viewable', fmt: 'int' },
  { key: 'viewability_rate', label: 'Viewability', fmt: 'pct' },
  { key: 'revenue', label: 'Revenue (₹)', fmt: 'money' },
  { key: 'ecpm', label: 'eCPM (₹)', fmt: 'money' },
  { key: 'rpm', label: 'RPM (₹)', fmt: 'money' },
]

function fmtVal(v: number, fmt: string) {
  if (v === null || v === undefined) return '—'
  if (fmt === 'pct') return v.toFixed(2) + '%'
  if (fmt === 'money') return v === 0 ? '—' : '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2 })
  return v.toLocaleString('en-IN')
}

export function ReportBuilder() {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0]

  const [dimensions, setDimensions] = useState<string[]>(['date', 'partner'])
  const [metrics, setMetrics] = useState<string[]>(['requests', 'fills', 'fill_rate', 'clicks', 'ctr'])
  const [start, setStart] = useState(weekAgo)
  const [end, setEnd] = useState(today)
  const [siteFilter, setSiteFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [sortKey, setSortKey] = useState<string>('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const toggle = (arr: string[], set: (v: string[]) => void, key: string) => {
    set(arr.includes(key) ? arr.filter(k => k !== key) : [...arr, key])
  }

  async function run() {
    if (!dimensions.length || !metrics.length) return
    setLoading(true); setReport(null)
    try {
      const res = await fetch('/api/mediation/report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimensions, metrics, start, end,
          filters: siteFilter ? { site_url: siteFilter } : {},
        }),
      })
      const data = await res.json()
      setReport(data)
      setSortKey(metrics[0])
    } catch { setReport({ error: 'Failed to run report' }) }
    finally { setLoading(false) }
  }

  const sortedRows = (() => {
    if (!report?.rows) return []
    const rows = [...report.rows]
    if (sortKey) {
      rows.sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey]
        const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return rows
  })()

  function exportCsv() {
    if (!report?.rows?.length) return
    const cols = [...dimensions, ...metrics]
    const header = cols.map(c => {
      const d = ALL_DIMENSIONS.find(x => x.key === c); const m = ALL_METRICS.find(x => x.key === c)
      return d?.label || m?.label || c
    }).join(',')
    const lines = sortedRows.map(r => cols.map(c => `"${r[c] ?? ''}"`).join(','))
    const csv = [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `report_${start}_${end}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function setSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  return (
    <div className="space-y-6">
      {/* ── Builder controls ── */}
      <div className="card p-5 space-y-5">
        {/* Dimensions */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2">Dimensions (group by)</p>
          <div className="flex flex-wrap gap-2">
            {ALL_DIMENSIONS.map(d => (
              <button key={d.key} onClick={() => toggle(dimensions, setDimensions, d.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  dimensions.includes(d.key)
                    ? 'bg-ink-900 text-white border-ink-900'
                    : 'bg-white text-ink-600 border-ink-200 hover:border-ink-400'}`}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
        {/* Metrics */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2">Metrics</p>
          <div className="flex flex-wrap gap-2">
            {ALL_METRICS.map(m => (
              <button key={m.key} onClick={() => toggle(metrics, setMetrics, m.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  metrics.includes(m.key)
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-white text-ink-600 border-ink-200 hover:border-ink-400'}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        {/* Date range + filter + run */}
        <div className="flex flex-wrap items-end gap-4 pt-1">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-400 mb-1">From</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)}
              className="border border-ink-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-400 mb-1">To</label>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)}
              className="border border-ink-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-400 mb-1">Site filter</label>
            <input type="text" placeholder="e.g. kannadadunia" value={siteFilter}
              onChange={e => setSiteFilter(e.target.value)}
              className="border border-ink-200 rounded-lg px-3 py-2 text-sm w-44" />
          </div>
          <button onClick={run} disabled={loading || !dimensions.length || !metrics.length}
            className="btn-primary px-6 py-2.5 disabled:opacity-50">
            {loading ? 'Running…' : 'Run report'}
          </button>
        </div>
      </div>

      {/* ── Results ── */}
      {report?.error && (
        <div className="card p-5 text-sm text-red-600">Couldn't run the report: {report.error}</div>
      )}
      {report && !report.error && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-ink-100">
            <p className="text-sm text-ink-500">
              {report.row_count} row{report.row_count !== 1 ? 's' : ''} · {report.date_range?.start} → {report.date_range?.end}
            </p>
            <button onClick={exportCsv} disabled={!report.rows?.length}
              className="text-sm font-medium text-ink-600 hover:text-ink-900 disabled:opacity-40">
              ↓ Export CSV
            </button>
          </div>
          {report.rows?.length === 0 ? (
            <div className="px-5 py-10 text-center text-ink-400 text-sm">
              No data for this range. Try widening the dates, or check that the tag is serving.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-2 text-ink-500">
                    {dimensions.map(d => (
                      <th key={d} onClick={() => setSort(d)}
                        className="text-left font-semibold px-4 py-2.5 cursor-pointer whitespace-nowrap hover:text-ink-900">
                        {ALL_DIMENSIONS.find(x => x.key === d)?.label}
                        {sortKey === d ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </th>
                    ))}
                    {metrics.map(m => (
                      <th key={m} onClick={() => setSort(m)}
                        className="text-right font-semibold px-4 py-2.5 cursor-pointer whitespace-nowrap hover:text-ink-900">
                        {ALL_METRICS.find(x => x.key === m)?.label}
                        {sortKey === m ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((r, i) => (
                    <tr key={i} className="border-t border-ink-50 hover:bg-surface-2/50">
                      {dimensions.map(d => (
                        <td key={d} className="px-4 py-2.5 text-ink-800 whitespace-nowrap">{r[d]}</td>
                      ))}
                      {metrics.map(m => {
                        const meta = ALL_METRICS.find(x => x.key === m)
                        return <td key={m} className="px-4 py-2.5 text-right tabular-nums text-ink-900 whitespace-nowrap">
                          {fmtVal(r[m], meta?.fmt || 'int')}
                        </td>
                      })}
                    </tr>
                  ))}
                </tbody>
                {report.totals && (
                  <tfoot>
                    <tr className="border-t-2 border-ink-200 bg-surface-2 font-semibold">
                      {dimensions.map((d, i) => (
                        <td key={d} className="px-4 py-2.5 text-ink-900">{i === 0 ? 'Total' : ''}</td>
                      ))}
                      {metrics.map(m => {
                        const meta = ALL_METRICS.find(x => x.key === m)
                        return <td key={m} className="px-4 py-2.5 text-right tabular-nums text-ink-900">
                          {fmtVal(report.totals[m], meta?.fmt || 'int')}
                        </td>
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      )}

      {!report && !loading && (
        <div className="card p-10 text-center text-ink-400 text-sm">
          Pick your dimensions and metrics above, then run the report.
        </div>
      )}
    </div>
  )
}
