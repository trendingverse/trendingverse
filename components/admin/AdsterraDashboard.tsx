'use client'
import { useState, useEffect } from 'react'

interface Totals {
  impressions: number; clicks: number; revenue_usd: number
  revenue_inr: number; cpm: number; ctr: number
}
interface ChartPoint { date: string; impressions: number; clicks: number; revenue: number; cpm: number }
interface DomainRow { domain: string; impressions: number; clicks: number; revenue: number; cpm: number }

export function AdsterraDashboard() {
  const [data, setData] = useState<{
    totals?: Totals; chartData?: ChartPoint[]
    domains?: DomainRow[]; error?: string
    period?: { startDate: string; endDate: string }
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('7')
  const [activeTab, setActiveTab] = useState<'overview' | 'domains'>('overview')

  useEffect(() => { fetchData() }, [period])

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch(`/api/adsterra?period=${period}`)
      const d = await res.json()
      setData(d)
    } catch (e) {
      setData({ error: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="space-y-4">
      {Array(3).fill(0).map((_, i) => (
        <div key={i} className="h-20 bg-ink-50 rounded-xl animate-pulse" />
      ))}
    </div>
  )

  if (data?.error) return (
    <div className="card p-6 text-center">
      <p className="text-4xl mb-3">📡</p>
      <p className="text-red-500 text-sm font-medium">{data.error}</p>
      <button onClick={fetchData} className="mt-3 text-xs px-3 py-1.5 bg-ink-100 rounded-lg">
        Retry
      </button>
    </div>
  )

  const { totals, chartData = [], domains = [] } = data || {}
  const maxRevenue = Math.max(...chartData.map(d => d.revenue), 0.001)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-green-600 font-medium">Adsterra Connected</span>
          <span className="text-xs text-ink-400">·</span>
          <span className="text-xs text-ink-400">{data?.period?.startDate} → {data?.period?.endDate}</span>
        </div>
        <div className="flex items-center gap-2">
          <select className="input text-xs w-32" value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <button onClick={fetchData} className="text-xs px-3 py-1.5 bg-ink-100 rounded-lg hover:bg-ink-200">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Revenue (USD)', value: `$${totals.revenue_usd.toFixed(4)}`, icon: '💰', color: 'text-green-600' },
            { label: 'Revenue (INR)', value: `₹${totals.revenue_inr.toFixed(2)}`, icon: '₹', color: 'text-emerald-600' },
            { label: 'Impressions', value: totals.impressions.toLocaleString(), icon: '👁', color: 'text-blue-600' },
            { label: 'Clicks', value: totals.clicks.toLocaleString(), icon: '👆', color: 'text-violet-600' },
            { label: 'eCPM', value: `$${totals.cpm.toFixed(4)}`, icon: '📊', color: 'text-amber-600' },
            { label: 'CTR', value: `${totals.ctr}%`, icon: '📈', color: totals.ctr > 1 ? 'text-green-600' : 'text-amber-500' },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ink-400">{s.label}</span>
                <span className="text-lg">{s.icon}</span>
              </div>
              <div className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-ink-100 rounded-xl w-fit">
        {[
          { key: 'overview', label: '📊 Daily Chart' },
          { key: 'domains', label: '🌐 By Domain' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as 'overview' | 'domains')}
            className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${activeTab === t.key ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Daily chart */}
      {activeTab === 'overview' && (
        <div className="card p-5">
          <h3 className="font-semibold text-ink-900 mb-4">Revenue — last {period} days</h3>
          {chartData.length === 0 ? (
            <p className="text-center py-8 text-ink-300 text-sm">No data for this period</p>
          ) : (
            <>
              <div className="flex items-end gap-0.5 h-32 mb-2">
                {chartData.map((d, i) => (
                  <div key={i} className="flex-1 group relative">
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-ink-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      {d.date.slice(5)} · ${d.revenue.toFixed(4)}
                    </div>
                    <div
                      className="w-full bg-green-400 hover:bg-green-500 rounded-t transition-colors"
                      style={{ height: `${Math.max(2, (d.revenue / maxRevenue) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-ink-300">
                <span>{chartData[0]?.date.slice(5)}</span>
                <span>{chartData[chartData.length - 1]?.date.slice(5)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Domain breakdown */}
      {activeTab === 'domains' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-ink-100">
            <h3 className="font-semibold text-ink-900">Revenue by Domain</h3>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="bg-ink-50 border-b border-ink-100">
              <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">Domain</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Impressions</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Clicks</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">eCPM</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Revenue</th>
            </tr></thead>
            <tbody>
              {domains.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-ink-300 text-sm">No domain data yet</td></tr>
              )}
              {domains.map((d, i) => (
                <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                  <td className="px-4 py-3 text-xs font-medium text-blue-600">{d.domain}</td>
                  <td className="px-4 py-3 text-xs text-right text-ink-600">{d.impressions.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-right text-ink-600">{d.clicks.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-right text-amber-600">${d.cpm.toFixed(4)}</td>
                  <td className="px-4 py-3 text-xs text-right font-bold text-green-600">${d.revenue.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
