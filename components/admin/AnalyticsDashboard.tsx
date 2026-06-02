'use client'
import { useState, useEffect } from 'react'

interface Stats {
  totalArticles: number; publishedArticles: number; draftArticles: number
  aiArticles: number; articlesToday: number; articlesThisWeek: number
  humanPublished: number; cronPublished: number
}
interface CronLog {
  id: string; status: 'success' | 'failed' | 'skipped'
  title: string; wp_url: string; error: string; ran_at: string
}
interface Article {
  id: string; title: string; status: string; view_count: number
  seo_score: number; published_at: string; ai_generated: boolean
  created_at: string; slug?: string
}
interface ChartPoint { date: string; count: number; human: number; cron: number }

export function AnalyticsDashboard() {
  const [data, setData] = useState<{
    stats: Stats; chartData: ChartPoint[]; recentArticles: Article[]
    allArticles: Article[]; cronLogs: CronLog[]
    cronStats: { success: number; failed: number; skipped: number }
    plan: string; articlesUsedToday: number; planLimit: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'human' | 'cron'>('all')
  const [showAllArticles, setShowAllArticles] = useState(false)

  useEffect(() => {
    fetch('/api/analytics-dashboard')
      .then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array(8).fill(0).map((_, i) => <div key={i} className="h-24 bg-ink-50 rounded-xl animate-pulse" />)}
    </div>
  )
  if (!data) return <div className="text-red-500">Failed to load analytics</div>

  const { stats, chartData, allArticles, cronLogs, cronStats, plan, articlesUsedToday, planLimit } = data
  const usagePct = Math.min(100, Math.round((articlesUsedToday / planLimit) * 100))
  const maxCount = Math.max(...chartData.map(d => d.count), 1)

  const filteredArticles = (allArticles || []).filter(a => {
    if (activeTab === 'human') return !a.ai_generated
    if (activeTab === 'cron')  return a.ai_generated
    return true
  })
  const displayedArticles = showAllArticles ? filteredArticles : filteredArticles.slice(0, 10)

  return (
    <div className="space-y-6">

      {/* Plan usage */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${plan === 'pro' ? 'bg-amber-100 text-amber-700' : 'bg-ink-100 text-ink-600'}`}>
              {plan} plan
            </span>
            <span className="text-sm text-ink-500">
              {articlesUsedToday} / {['pro','byoak','agency'].includes(plan) ? '∞' : planLimit} articles today
            </span>
          </div>
          {plan === 'free' && (
            <a href="/pricing" className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-lg font-medium">
              Upgrade →
            </a>
          )}
        </div>
        {plan === 'free' && (
          <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${usagePct > 80 ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${usagePct}%` }} />
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Articles',   value: stats.totalArticles,    icon: '▤',  color: 'text-ink-900' },
          { label: 'Published',        value: stats.publishedArticles, icon: '✓',  color: 'text-green-600' },
          { label: 'Drafts',           value: stats.draftArticles,     icon: '◎',  color: 'text-amber-500' },
          { label: 'AI Generated',     value: stats.aiArticles,        icon: '✦',  color: 'text-violet-600' },
          { label: 'Today',            value: stats.articlesToday,     icon: '☀',  color: 'text-blue-600' },
          { label: 'This Week',        value: stats.articlesThisWeek,  icon: '📅', color: 'text-teal-600' },
          { label: 'Cron Success',     value: cronStats.success,        icon: '⚡', color: 'text-green-600' },
          { label: 'Cron Failed',      value: cronStats.failed,         icon: '⚠', color: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-ink-400">{s.label}</span>
              <span className="text-lg">{s.icon}</span>
            </div>
            <div className={`text-3xl font-display font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Source breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl">👤</div>
          <div>
            <p className="text-xs text-ink-400 mb-1">Published by Human</p>
            <p className="text-3xl font-display font-bold text-blue-600">{stats.humanPublished}</p>
            <p className="text-xs text-ink-400 mt-1">Manually pushed to WordPress</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center text-2xl">⚡</div>
          <div>
            <p className="text-xs text-ink-400 mb-1">Published by Cron</p>
            <p className="text-3xl font-display font-bold text-violet-600">{stats.cronPublished}</p>
            <p className="text-xs text-ink-400 mt-1">Auto-published daily at ~9 AM IST</p>
          </div>
        </div>
      </div>

      {/* 30-day chart */}
      <div className="card p-5">
        <h3 className="font-semibold text-ink-900 mb-1">Articles published — last 30 days</h3>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-blue-400 inline-block" />
            <span className="text-xs text-ink-500">Human</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-violet-400 inline-block" />
            <span className="text-xs text-ink-500">Cron</span>
          </div>
        </div>
        <div className="flex items-end gap-1 h-32">
          {chartData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0 group relative">
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-ink-900 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
                {d.date.slice(5)}: {d.human}👤 {d.cron}⚡
              </div>
              {/* Stacked bar — cron on top */}
              <div className="w-full flex flex-col justify-end" style={{ height: `${Math.max(2, (d.count / maxCount) * 100)}%` }}>
                {d.cron > 0 && (
                  <div className="w-full bg-violet-400 hover:bg-violet-500 rounded-t transition-all"
                    style={{ height: `${(d.cron / Math.max(d.count, 1)) * 100}%` }} />
                )}
                {d.human > 0 && (
                  <div className="w-full bg-blue-400 hover:bg-blue-500 transition-all"
                    style={{ height: `${(d.human / Math.max(d.count, 1)) * 100}%` }} />
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-ink-300 mt-1">
          <span>{chartData[0]?.date.slice(5)}</span>
          <span>{chartData[chartData.length - 1]?.date.slice(5)}</span>
        </div>
      </div>

      {/* Detailed article list */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-ink-100 flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-semibold text-ink-900">Article List</h3>
          <div className="flex gap-1 p-0.5 bg-ink-100 rounded-lg">
            {([
              { key: 'all',   label: `All (${allArticles?.length || 0})` },
              { key: 'human', label: `👤 Human (${stats.humanPublished})` },
              { key: 'cron',  label: `⚡ Cron (${stats.cronPublished})` },
            ] as const).map(t => (
              <button key={t.key} onClick={() => { setActiveTab(t.key); setShowAllArticles(false) }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === t.key ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="bg-ink-50 border-b border-ink-100">
            <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">Title</th>
            <th className="text-center px-3 py-2 text-xs font-medium text-ink-500">Source</th>
            <th className="text-center px-3 py-2 text-xs font-medium text-ink-500">Status</th>
            <th className="text-right px-3 py-2 text-xs font-medium text-ink-500">SEO</th>
            <th className="text-right px-3 py-2 text-xs font-medium text-ink-500">Views</th>
            <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Date</th>
          </tr></thead>
          <tbody>
            {displayedArticles.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-ink-300 text-sm">No articles found</td></tr>
            )}
            {displayedArticles.map(a => (
              <tr key={a.id} className="border-b border-ink-50 hover:bg-ink-50/50">
                <td className="px-4 py-2.5 max-w-xs">
                  <p className="text-xs font-medium text-ink-900 truncate">{a.title}</p>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    (a as any).source === 'cron' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {(a as any).source === 'cron' ? '⚡ Cron' : '👤 Human'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    a.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>{a.status}</span>
                </td>
                <td className="px-3 py-2.5 text-right text-xs text-ink-500">{a.seo_score || '-'}</td>
                <td className="px-3 py-2.5 text-right text-xs text-ink-500">{a.view_count || 0}</td>
                <td className="px-4 py-2.5 text-right text-xs text-ink-400 whitespace-nowrap">
                  {new Date(a.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredArticles.length > 10 && (
          <div className="p-3 border-t border-ink-100 text-center">
            <button onClick={() => setShowAllArticles(!showAllArticles)}
              className="text-xs text-blue-600 hover:underline font-medium">
              {showAllArticles ? 'Show less' : `Show all ${filteredArticles.length} articles`}
            </button>
          </div>
        )}
      </div>

      {/* Cron history */}
      <div className="card p-5">
        <h3 className="font-semibold text-ink-900 mb-1">Auto-publish Cron History</h3>
        <p className="text-xs text-ink-400 mb-4">Runs daily at ~9:00 AM IST — fetches trending topic, generates &amp; publishes automatically</p>
        <div className="space-y-2">
          {cronLogs.length === 0 && <p className="text-sm text-ink-300">No cron runs yet</p>}
          {cronLogs.map(log => (
            <div key={log.id} className={`flex items-start gap-3 p-3 rounded-xl border ${
              log.status === 'success' ? 'bg-green-50 border-green-100' :
              log.status === 'failed'  ? 'bg-red-50 border-red-100' :
              'bg-amber-50 border-amber-100'
            }`}>
              <span className={`mt-0.5 font-bold ${
                log.status === 'success' ? 'text-green-500' :
                log.status === 'failed'  ? 'text-red-500' : 'text-amber-500'
              }`}>
                {log.status === 'success' ? '✓' : log.status === 'failed' ? '✗' : '⊘'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    log.status === 'success' ? 'bg-green-100 text-green-700' :
                    log.status === 'failed'  ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>{log.status}</span>
                  <span className="text-xs text-ink-400">
                    {new Date(log.ran_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} IST
                  </span>
                </div>
                {log.title && <p className="text-xs font-medium text-ink-900 truncate">{log.title}</p>}
                {!log.title && log.error && <p className="text-xs text-red-600 truncate">{log.error}</p>}
                {log.wp_url && log.wp_url !== 'https://trendingverse.online' && (
                  <a href={log.wp_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline">View live post →</a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
