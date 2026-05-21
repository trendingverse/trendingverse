'use client'
import { useState, useEffect } from 'react'

interface Site { name: string; site_url: string; articles_count: number }
interface Publisher {
  id: string
  email: string
  full_name: string
  plan: 'free' | 'pro'
  subscription_status: string
  articles_total: number
  articles_today: number
  sites: Site[]
  sites_count: number
  joined_at: string
  last_sign_in: string | null
}
interface Stats {
  total_publishers: number
  pro_publishers: number
  free_publishers: number
  total_articles: number
  total_sites: number
}

export function PublishersPanel() {
  const [publishers, setPublishers] = useState<Publisher[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pro' | 'free'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/publishers')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else { setPublishers(data.publishers || []); setStats(data.stats) }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = publishers.filter(p => {
    const matchSearch = p.email.toLowerCase().includes(search.toLowerCase()) ||
      p.full_name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || p.plan === filter
    return matchSearch && matchFilter
  })

  if (loading) return (
    <div className="space-y-3">
      {Array(5).fill(0).map((_, i) => <div key={i} className="h-16 bg-ink-50 rounded-xl animate-pulse" />)}
    </div>
  )

  if (error) return <div className="p-4 bg-red-50 text-red-600 rounded-xl">{error}</div>

  return (
    <div className="space-y-6">
      {/* Stats overview */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Publishers', value: stats.total_publishers, icon: '👥', color: 'text-ink-900' },
            { label: 'Pro', value: stats.pro_publishers, icon: '⭐', color: 'text-amber-600' },
            { label: 'Free', value: stats.free_publishers, icon: '🆓', color: 'text-ink-500' },
            { label: 'Total Articles', value: stats.total_articles, icon: '📝', color: 'text-blue-600' },
            { label: 'Connected Sites', value: stats.total_sites, icon: '🌐', color: 'text-green-600' },
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
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by email or name..."
          className="input flex-1 min-w-48"
        />
        <div className="flex gap-1 p-1 bg-ink-100 rounded-xl">
          {(['all', 'pro', 'free'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${filter === f ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
              {f}
            </button>
          ))}
        </div>
        <span className="text-sm text-ink-400">{filtered.length} publishers</span>
      </div>

      {/* Publishers table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">Publisher</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">Plan</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">Articles</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">Sites</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">Joined</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">Last active</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-ink-300">No publishers found</td></tr>
            )}
            {filtered.map(p => (
              <>
                <tr key={p.id} className="border-b border-ink-50 hover:bg-ink-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-ink-900">{p.full_name}</p>
                      <p className="text-xs text-ink-400">{p.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.plan === 'pro' ? 'bg-amber-100 text-amber-700' : 'bg-ink-100 text-ink-600'}`}>
                      {p.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-semibold text-ink-900">{p.articles_total}</span>
                      <span className="text-xs text-ink-400 ml-1">total</span>
                      {p.articles_today > 0 && (
                        <span className="ml-2 text-xs text-green-600">+{p.articles_today} today</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-ink-900">{p.sites_count}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-400">
                    {new Date(p.joined_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-400">
                    {p.last_sign_in ? new Date(p.last_sign_in).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {p.sites_count > 0 && (
                      <button onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                        className="text-xs text-accent hover:underline">
                        {expanded === p.id ? 'Hide sites ▲' : 'Sites ▼'}
                      </button>
                    )}
                  </td>
                </tr>
                {expanded === p.id && p.sites.length > 0 && (
                  <tr key={`${p.id}-sites`} className="bg-blue-50/30">
                    <td colSpan={7} className="px-8 py-3">
                      <div className="space-y-1">
                        {p.sites.map((s, i) => (
                          <div key={i} className="flex items-center gap-4 text-xs">
                            <span className="text-ink-500">🌐</span>
                            <span className="font-medium text-ink-700">{s.name}</span>
                            <a href={s.site_url} target="_blank" rel="noopener noreferrer"
                              className="text-blue-500 hover:underline">{s.site_url}</a>
                            <span className="text-ink-400">{s.articles_count || 0} articles</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
