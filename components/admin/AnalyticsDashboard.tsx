'use client'
import { useState, useEffect } from 'react'

interface Stats {
  totalArticles: number
  publishedArticles: number
  draftArticles: number
  aiArticles: number
  articlesToday: number
  articlesThisWeek: number
}
interface CronLog {
  id: string
  status: 'success' | 'failed' | 'skipped'
  title: string
  wp_url: string
  error: string
  ran_at: string
}
interface Article {
  id: string
  title: string
  status: string
  view_count: number
  seo_score: number
  published_at: string
  ai_generated: boolean
}
interface ChartPoint { date: string; count: number }

export function AnalyticsDashboard() {
  const [data, setData] = useState<{
    stats: Stats
    chartData: ChartPoint[]
    recentArticles: Article[]
    cronLogs: CronLog[]
    cronStats: { success: number; failed: number; skipped: number }
    plan: string
    articlesUsedToday: number
    planLimit: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics-dashboard')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array(8).fill(0).map((_, i) => <div key={i} className="h-24 bg-ink-50 rounded-xl animate-pulse" />)}
    </div>
  )
  if (!data) return <div className="text-red-500">Failed to load analytics</div>

  const { stats, chartData, recentArticles, cronLogs, cronStats, plan, articlesUsedToday, planLimit } = data
  const usagePct = Math.min(100, Math.round((articlesUsedToday / planLimit) * 100))
  const maxCount = Math.max(...chartData.map(d => d.count), 1)

  const statCards = [
    { label: 'Total Articles', value: stats.totalArticles, icon: '▤', color: 'text-ink-900' },
    { label: 'Published', value: stats.publishedArticles, icon: '✓', color: 'text-green-600' },
    { label: 'Drafts', value: stats.draftArticles, icon: '◎', color: 'text-amber-500' },
    { label: 'AI Generated', value: stats.aiArticles, icon: '✦', color: 'text-violet-600' },
    { label: 'Today', value: stats.articlesToday, icon: '☀', color: 'text-blue-600' },
    { label: 'This Week', value: stats.articlesThisWeek, icon: '📅', color: 'text-teal-600' },
    { label: 'Cron Success', value: cronStats.success, icon: '⚡', color: 'text-green-600' },
    { label: 'Cron Failed', value: cronStats.failed, icon: '⚠', color: 'text-red-500' },
  ]

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
              {articlesUsedToday} / {plan === 'pro' ? '∞' : planLimit} articles today
            </span>
          </div>
          {plan === 'free' && (
            <a href="/pricing" className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium">
              Upgrade to Pro →
            </a>
          )}
        </div>
        {plan === 'free' && (
          <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${usagePct > 80 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${usagePct}%` }} />
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-ink-400">{s.label}</span>
              <span className="text-lg">{s.icon}</span>
            </div>
            <div className={`text-3xl font-display font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* 30-day chart */}
      <div className="card p-5">
        <h3 className="font-semibold text-ink-900 mb-4">Articles published — last 30 days</h3>
        <div className="flex items-end gap-1 h-32">
          {chartData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-ink-900 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {d.date.slice(5)}: {d.count}
              </div>
              <div
                className="w-full rounded-t transition-all bg-accent/70 hover:bg-accent"
                style={{ height: `${Math.max(2, (d.count / maxCount) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-ink-300 mt-1">
          <span>{chartData[0]?.date.slice(5)}</span>
          <span>{chartData[chartData.length - 1]?.date.slice(5)}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent articles */}
        <div className="card p-5">
          <h3 className="font-semibold text-ink-900 mb-4">Recent articles</h3>
          <div className="space-y-2">
            {recentArticles.length === 0 && <p className="text-sm text-ink-300">No articles yet</p>}
            {recentArticles.map(a => (
              <div key={a.id} className="flex items-center gap-3 p-3 bg-ink-50 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900 truncate">{a.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      a.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>{a.status}</span>

                    {/* Source badge — cron vs user */}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      a.ai_generated
                        ? 'bg-violet-100 text-violet-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {a.ai_generated ? '⚡ Cron' : '👤 User'}
                    </span>

                    <span className="text-xs text-ink-400">SEO: {a.seo_score}</span>
                    <span className="text-xs text-ink-400">{a.view_count} views</span>
                    {a.published_at && (
                      <span className="text-xs text-ink-300">
                        {new Date(a.published_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cron history */}
        <div className="card p-5">
          <h3 className="font-semibold text-ink-900 mb-1">Auto-publish cron history</h3>
          <p className="text-xs text-ink-400 mb-4">Runs daily at ~9:00 AM IST — fetches trending topic, generates & publishes automatically</p>
          <div className="space-y-2">
            {cronLogs.length === 0 && <p className="text-sm text-ink-300">No cron runs yet</p>}
            {cronLogs.map(log => (
              <div key={log.id} className={`flex items-start gap-3 p-3 rounded-xl border ${
                log.status === 'success' ? 'bg-green-50 border-green-100' :
                log.status === 'failed'  ? 'bg-red-50 border-red-100' :
                'bg-amber-50 border-amber-100'
              }`}>
                <span className={`mt-0.5 text-base font-bold ${
                  log.status === 'success' ? 'text-green-500' :
                  log.status === 'failed'  ? 'text-red-500' : 'text-amber-500'
                }`}>
                  {log.status === 'success' ? '✓' : log.status === 'failed' ? '✗' : '⊘'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      log.status === 'success' ? 'bg-green-100 text-green-700' :
                      log.status === 'failed'  ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{log.status}</span>
                    <span className="text-xs text-ink-400">
                      {new Date(log.ran_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} IST
                    </span>
                  </div>
                  {log.title ? (
                    <p className="text-xs font-medium text-ink-900 truncate">{log.title}</p>
                  ) : log.error ? (
                    <p className="text-xs text-red-600 truncate">{log.error}</p>
                  ) : null}
                  {log.wp_url && log.wp_url !== 'https://trendingverse.online' && (
                    <a href={log.wp_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline">
                      View live post →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
