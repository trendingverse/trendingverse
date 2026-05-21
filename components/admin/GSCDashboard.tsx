'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

interface Overview { totalClicks: number; totalImpressions: number; avgCTR: number; avgPosition: number }
interface ChartPoint { date: string; clicks: number; impressions: number; ctr: number }
interface PageRow { page: string; clicks: number; impressions: number; ctr: number; position: number }
interface QueryRow { query: string; clicks: number; impressions: number; ctr: number; position: number }
interface DiscoverRow { page: string; clicks: number; impressions: number }

export function GSCDashboard() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<{
    connected: boolean; site?: string; overview?: Overview; chartData?: ChartPoint[]
    topPages?: PageRow[]; topQueries?: QueryRow[]; discoverPages?: DiscoverRow[]
    lowCtrPages?: PageRow[]; error?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview'|'pages'|'queries'|'discover'|'improve'>('overview')
  const [rewritingPage, setRewritingPage] = useState<string | null>(null)
  const [rewrites, setRewrites] = useState<Record<string, string[]>>({})

useEffect(() => {
  fetchData()
}, [])

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch('/api/gsc/data')
      setData(await res.json())
    } catch (e) {
      setData({ connected: false, error: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }

  async function rewriteHeadlines(page: string) {
    setRewritingPage(page)
    try {
      const res = await fetch('/api/ai/headlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: page.replace(/[-/]/g, ' ').trim(), count: 5 }),
      })
      const d = await res.json()
      setRewrites(prev => ({ ...prev, [page]: d.headlines || [] }))
    } catch { /* ignore */ }
    setRewritingPage(null)
  }

  if (loading) return (
    <div className="space-y-4">
      {Array(3).fill(0).map((_, i) => <div key={i} className="h-24 bg-ink-50 rounded-xl animate-pulse" />)}
    </div>
  )

  if (!data?.connected) return (
    <div className="card p-8 text-center">
      <div className="text-5xl mb-4">🔍</div>
      <h3 className="font-display font-bold text-ink-900 text-xl mb-2">Connect Google Search Console</h3>
      <p className="text-ink-500 text-sm mb-3 max-w-md mx-auto">
        See clicks, impressions, keyword rankings, and Google Discover traffic for your site.
      </p>
      {data?.error && (
        <p className="text-red-500 text-xs mb-4 bg-red-50 px-3 py-2 rounded-lg inline-block">{data.error}</p>
      )}
      {searchParams.get('gsc') === 'error' && (
        <p className="text-red-500 text-xs mb-4">Connection failed — check your Google OAuth credentials in Vercel env vars.</p>
      )}
      <a href="/api/gsc/auth"
        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
        🔗 Connect Google Search Console
      </a>
      <p className="text-xs text-ink-400 mt-4">You'll be redirected to Google to authorize — takes 30 seconds</p>
    </div>
  )

  const { overview, chartData = [], topPages = [], topQueries = [], discoverPages = [], lowCtrPages = [] } = data
  const maxClicks = Math.max(...chartData.map(d => d.clicks), 1)
  const maxImpressions = Math.max(...chartData.map(d => d.impressions), 1)

  const tabs = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'pages', label: '📄 Top Pages' },
    { key: 'queries', label: '🔍 Queries' },
    { key: 'discover', label: '✨ Discover' },
    { key: 'improve', label: `⚠ Improve (${lowCtrPages.length})` },
  ] as const

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-green-600 font-medium">GSC Connected</span>
          <span className="text-xs text-ink-400">· {data.site} · Last 28 days</span>
        </div>
        <button onClick={fetchData} className="text-xs px-3 py-1.5 bg-ink-100 rounded-lg hover:bg-ink-200 transition-colors">
          ↻ Refresh
        </button>
      </div>

      {/* Stat cards */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Clicks', value: overview.totalClicks.toLocaleString(), icon: '👆', color: 'text-blue-600' },
            { label: 'Impressions', value: overview.totalImpressions.toLocaleString(), icon: '👁', color: 'text-violet-600' },
            { label: 'Avg CTR', value: `${overview.avgCTR}%`, icon: '📈', color: overview.avgCTR > 3 ? 'text-green-600' : 'text-amber-500' },
            { label: 'Avg Position', value: `#${overview.avgPosition}`, icon: '🎯', color: overview.avgPosition <= 10 ? 'text-green-600' : 'text-ink-600' },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ink-400">{s.label}</span>
                <span>{s.icon}</span>
              </div>
              <div className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-ink-100 rounded-xl overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${activeTab === t.key ? 'bg-white shadow text-ink-900' : 'text-ink-500 hover:text-ink-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview chart */}
      {activeTab === 'overview' && (
        <div className="card p-5">
          <h3 className="font-semibold text-ink-900 mb-4">Clicks vs Impressions — 28 days</h3>
          <div className="flex items-end gap-0.5 h-36">
            {chartData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-ink-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {d.date.slice(5)} · 👆{d.clicks} 👁{d.impressions}
                </div>
                <div className="w-full flex flex-col justify-end gap-0.5 h-32">
                  <div className="w-full bg-violet-200 rounded-sm" style={{ height: `${Math.max(2, (d.impressions / maxImpressions) * 60)}%` }} />
                  <div className="w-full bg-blue-500 rounded-sm" style={{ height: `${Math.max(d.clicks > 0 ? 2 : 0, (d.clicks / maxClicks) * 40)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-ink-400">
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-blue-500 rounded-sm inline-block" />Clicks</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-violet-200 rounded-sm inline-block" />Impressions</span>
          </div>
        </div>
      )}

      {/* Top Pages */}
      {activeTab === 'pages' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-ink-100"><h3 className="font-semibold text-ink-900">Top Pages by Clicks</h3></div>
          <table className="w-full text-sm">
            <thead><tr className="bg-ink-50 border-b border-ink-100">
              <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">Page</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Clicks</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Impressions</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">CTR</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Position</th>
            </tr></thead>
            <tbody>
              {topPages.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-ink-300">No data yet — check back after Google indexes your site</td></tr>}
              {topPages.map((p, i) => (
                <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                  <td className="px-4 py-3 text-xs text-blue-600 max-w-xs truncate">{p.page || '/'}</td>
                  <td className="px-4 py-3 text-xs text-right font-medium">{p.clicks}</td>
                  <td className="px-4 py-3 text-xs text-right text-ink-500">{p.impressions}</td>
                  <td className="px-4 py-3 text-xs text-right">
                    <span className={p.ctr > 3 ? 'text-green-600' : p.ctr > 1 ? 'text-amber-500' : 'text-red-500'}>{p.ctr}%</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-right text-ink-600">#{p.position}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Top Queries */}
      {activeTab === 'queries' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-ink-100"><h3 className="font-semibold text-ink-900">Top Search Queries</h3></div>
          <table className="w-full text-sm">
            <thead><tr className="bg-ink-50 border-b border-ink-100">
              <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">Query</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Clicks</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Impressions</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">CTR</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Position</th>
            </tr></thead>
            <tbody>
              {topQueries.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-ink-300">No queries yet</td></tr>}
              {topQueries.map((q, i) => (
                <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                  <td className="px-4 py-3 text-xs font-medium text-ink-800">{q.query}</td>
                  <td className="px-4 py-3 text-xs text-right font-medium">{q.clicks}</td>
                  <td className="px-4 py-3 text-xs text-right text-ink-500">{q.impressions}</td>
                  <td className="px-4 py-3 text-xs text-right">
                    <span className={q.ctr > 3 ? 'text-green-600' : q.ctr > 1 ? 'text-amber-500' : 'text-red-500'}>{q.ctr}%</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-right text-ink-600">#{q.position}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Discover */}
      {activeTab === 'discover' && (
        <div className="card p-5">
          <h3 className="font-semibold text-ink-900 mb-4">✨ Google Discover Traffic</h3>
          {discoverPages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-3">📱</p>
              <p className="text-ink-500 text-sm">No Discover traffic yet</p>
              <p className="text-ink-400 text-xs mt-1">Articles need Google indexing + impressions before appearing here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {discoverPages.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-ink-50 rounded-xl">
                  <span className="text-xs text-blue-600 truncate flex-1">{p.page}</span>
                  <div className="flex items-center gap-4 ml-4 shrink-0">
                    <span className="text-xs"><span className="font-medium">{p.clicks}</span> <span className="text-ink-400">clicks</span></span>
                    <span className="text-xs"><span className="font-medium">{p.impressions}</span> <span className="text-ink-400">impressions</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Improve — Low CTR */}
      {activeTab === 'improve' && (
        <div className="card p-5">
          <h3 className="font-semibold text-ink-900 mb-1">⚠ Low CTR Pages — AI Headline Suggestions</h3>
          <p className="text-xs text-ink-400 mb-4">Pages with 100+ impressions but less than 1% CTR — get AI headline rewrites to boost clicks</p>
          {lowCtrPages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-3">🎉</p>
              <p className="text-ink-500 text-sm">No low CTR pages — great job!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {lowCtrPages.map((p, i) => (
                <div key={i} className="p-4 border border-amber-100 bg-amber-50/30 rounded-xl">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <span className="text-xs text-blue-600 font-medium truncate max-w-xs">{p.page}</span>
                    <div className="flex items-center gap-3 text-xs shrink-0">
                      <span className="text-ink-500">{p.impressions} impressions</span>
                      <span className="text-red-500 font-medium">{p.ctr}% CTR</span>
                      <button onClick={() => rewriteHeadlines(p.page)} disabled={rewritingPage === p.page}
                        className="px-3 py-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors">
                        {rewritingPage === p.page ? '⟳ Generating...' : '✦ AI Headlines'}
                      </button>
                    </div>
                  </div>
                  {rewrites[p.page] && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-xs font-medium text-ink-600 mb-2">Suggested headlines:</p>
                      {rewrites[p.page].map((h, j) => (
                        <div key={j} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-ink-100">
                          <span className="text-xs text-amber-600 font-bold shrink-0">{j + 1}</span>
                          <span className="text-xs text-ink-800">{h}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
