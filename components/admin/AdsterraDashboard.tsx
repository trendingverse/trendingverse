'use client'
import { useState, useEffect } from 'react'

interface Totals {
  impressions: number; clicks: number; cpm: number; ctr: number
  revenue_usd?: number; revenue_inr?: number
  publisher_earnings_usd?: number; platform_earnings_usd?: number
  your_earnings_usd?: number; your_earnings_inr?: number
  gross_revenue_usd?: number
}
interface ChartPoint {
  date: string; impressions: number; clicks: number
  revenue?: number; earnings?: number
}
interface DomainRow {
  domain: string; site_name: string; impressions: number; clicks: number
  ctr: number; cpm: number; gross_revenue: number
  publisher_earnings: number; platform_earnings: number; revenue_share_pct: number
}

export function AdsterraDashboard({ isAdmin = false }: { isAdmin?: boolean }) {
  const [data, setData] = useState<{
    role?: string; totals?: Totals; chartData?: ChartPoint[]
    domains?: DomainRow[]; error?: string; no_site?: boolean
    period?: { startDate: string; endDate: string }
    revenue_share_pct?: number
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-green-600 font-medium">
            {isPublisher ? 'Your Ad Revenue' : 'Adsterra Network Revenue'}
          </span>
          <span className="text-xs text-ink-400">· {data?.period?.startDate} → {data?.period?.endDate}</span>
          {isPublisher && data?.revenue_share_pct && (
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
              Your share: {data.revenue_share_pct}%
            </span>
          )}
        </div>
        <div className="flex gap-2">
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isPublisher ? [
            { label: 'Your Earnings (USD)', value: `$${totals.your_earnings_usd?.toFixed(4) || '0.0000'}`, icon: '💰', color: 'text-green-600' },
            { label: 'Your Earnings (INR)', value: `₹${totals.your_earnings_inr?.toFixed(2) || '0.00'}`, icon: '₹', color: 'text-emerald-600' },
            { label: 'Impressions', value: totals.impressions.toLocaleString(), icon: '👁', color: 'text-blue-600' },
            { label: 'Clicks', value: totals.clicks.toLocaleString(), icon: '👆', color: 'text-violet-600' },
            { label: 'eCPM', value: `$${totals.cpm.toFixed(4)}`, icon: '📊', color: 'text-amber-600' },
            { label: 'CTR', value: `${totals.ctr}%`, icon: '📈', color: totals.ctr > 1 ? 'text-green-600' : 'text-amber-500' },
          ] : [
            { label: 'Total Revenue (USD)', value: `$${totals.revenue_usd?.toFixed(4) || '0.0000'}`, icon: '💰', color: 'text-green-600' },
            { label: 'Publisher Payouts', value: `$${totals.publisher_earnings_usd?.toFixed(4) || '0.0000'}`, icon: '👤', color: 'text-blue-600' },
            { label: 'Platform Earnings', value: `$${totals.platform_earnings_usd?.toFixed(4) || '0.0000'}`, icon: '🏢', color: 'text-violet-600' },
            { label: 'Total Revenue (INR)', value: `₹${totals.revenue_inr?.toFixed(2) || '0.00'}`, icon: '₹', color: 'text-emerald-600' },
            { label: 'Impressions', value: totals.impressions.toLocaleString(), icon: '👁', color: 'text-ink-900' },
            { label: 'Clicks', value: totals.clicks.toLocaleString(), icon: '👆', color: 'text-ink-900' },
            { label: 'Network eCPM', value: `$${totals.cpm.toFixed(4)}`, icon: '📊', color: 'text-amber-600' },
            { label: 'Network CTR', value: `${totals.ctr}%`, icon: '📈', color: totals.ctr > 1 ? 'text-green-600' : 'text-amber-500' },
          ].map(s => (
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

      {/* Tabs — admin only sees domain tab */}
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
            {isPublisher ? 'Your Earnings' : 'Network Revenue'} — last {period} days
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
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-ink-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        {d.date.slice(5)} · ${val.toFixed(4)}
                      </div>
                      <div
                        className="w-full bg-green-400 hover:bg-green-500 rounded-t transition-colors"
                        style={{ height: `${Math.max(2, (val / maxVal) * 100)}%` }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between text-xs text-ink-300">
                <span>{chartData[0]?.date.slice(5)}</span>
                <span>{chartData[chartData.length - 1]?.date.slice(5)}</span>
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
            <p className="text-xs text-ink-400 mt-1">Gross revenue, publisher payout and platform earnings per site</p>
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
                  <tr><td colSpan={8} className="text-center py-8 text-ink-300 text-sm">No domain data for this period</td></tr>
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
                    <td className="px-4 py-3 text-xs text-right font-medium text-ink-900">${d.gross_revenue.toFixed(4)}</td>
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
