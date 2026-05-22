'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

interface Overview {
  sessions: number; activeUsers: number; pageViews: number
  bounceRate: number; avgSessionDuration: number; newUsers: number
}
interface ChartPoint { date: string; sessions: number; users: number; pageViews: number }
interface PageRow { page: string; pageViews: number; users: number; avgDuration: number }
interface SourceRow { source: string; sessions: number; users: number }
interface DeviceRow { device: string; sessions: number; users: number }

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}m ${s}s`
}

const SOURCE_COLORS: Record<string, string> = {
  'Organic Search': 'bg-green-500',
  'Direct': 'bg-blue-500',
  'Organic Social': 'bg-pink-500',
  'Referral': 'bg-purple-500',
  'Email': 'bg-amber-500',
  'Paid Search': 'bg-red-500',
  'Organic Video': 'bg-teal-500',
}

export function GA4Dashboard() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading'|'not_connected'|'select_property'|'connected'|'error'>('loading')
  const [properties, setProperties] = useState<{ id: string; displayName: string; accountName: string }[]>([])
  const [selectedProp, setSelectedProp] = useState('')
  const [selectedPropName, setSelectedPropName] = useState('')
  const [data, setData] = useState<{
    property?: { id: string; name: string }; overview?: Overview
    chartData?: ChartPoint[]; topPages?: PageRow[]
    sources?: SourceRow[]; devices?: DeviceRow[]; error?: string
  } | null>(null)
  const [activeTab, setActiveTab] = useState<'overview'|'pages'|'sources'|'devices'>('overview')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const ga4Param = searchParams.get('ga4')
    if (ga4Param === 'select_property') {
      fetchProperties()
    } else {
      fetchData()
    }
  }, [])

  async function fetchProperties() {
    setStatus('loading')
    try {
      const res = await fetch('/api/ga4/properties')
      const d = await res.json()
      if (!d.connected) { setStatus('not_connected'); return }
      setProperties(d.properties || [])
      if (d.selected_property_id) {
        setSelectedProp(d.selected_property_id)
        setSelectedPropName(d.selected_property_name || d.selected_property_id)
        fetchData()
        return
      }
      setStatus('select_property')
    } catch { setStatus('not_connected') }
  }

  async function saveProperty() {
    if (!selectedProp) return
    setSaving(true)
    try {
      await fetch('/api/ga4/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: selectedProp, property_name: selectedPropName }),
      })
      fetchData()
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function fetchData() {
    setStatus('loading')
    try {
      const res = await fetch('/api/ga4/data')
      const d = await res.json()
      if (!d.connected) { setStatus('not_connected'); return }
      if (d.needs_property) { fetchProperties(); return }
      if (d.error) { setData(d); setStatus('error'); return }
      setData(d)
      setStatus('connected')
    } catch { setStatus('not_connected') }
  }

  if (status === 'loading') return (
    <div className="space-y-4">
      {Array(3).fill(0).map((_, i) => <div key={i} className="h-20 bg-ink-50 rounded-xl animate-pulse" />)}
    </div>
  )

  if (status === 'not_connected') return (
    <div className="card p-8 text-center">
      <div className="text-5xl mb-4">📈</div>
      <h3 className="font-display font-bold text-ink-900 text-xl mb-2">Connect Google Analytics 4</h3>
      <p className="text-ink-500 text-sm mb-6 max-w-md mx-auto">
        See sessions, pageviews, traffic sources, device breakdown and top pages for your WordPress site.
      </p>
      {searchParams.get('ga4') === 'error' && (
        <p className="text-red-500 text-xs mb-4 bg-red-50 px-3 py-2 rounded-lg inline-block">
          {searchParams.get('reason') || 'Connection failed — try again'}
        </p>
      )}
      <a href="/api/ga4/auth"
        className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors">
        📊 Connect Google Analytics 4
      </a>
      <p className="text-xs text-ink-400 mt-4">Each publisher connects their own GA4 property</p>
    </div>
  )

  if (status === 'select_property') return (
    <div className="card p-6">
      <h3 className="font-semibold text-ink-900 mb-1">Select your GA4 property</h3>
      <p className="text-xs text-ink-400 mb-4">Choose which Google Analytics property to connect to your dashboard</p>
      {properties.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-ink-400 text-sm">No GA4 properties found on this Google account.</p>
          <p className="text-ink-400 text-xs mt-1">Make sure you have a GA4 property set up at analytics.google.com</p>
          <a href="/api/ga4/auth" className="text-orange-500 text-sm underline mt-3 inline-block">Try reconnecting →</a>
        </div>
      ) : (
        <div className="space-y-3">
          {properties.map(p => (
            <label key={p.id}
              className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${selectedProp === p.id ? 'border-orange-400 bg-orange-50/30' : 'border-ink-100 hover:border-ink-200'}`}>
              <input type="radio" name="property" value={p.id} checked={selectedProp === p.id}
                onChange={() => { setSelectedProp(p.id); setSelectedPropName(p.displayName) }}
                className="accent-orange-500" />
              <div>
                <p className="font-medium text-ink-900 text-sm">{p.displayName}</p>
                <p className="text-xs text-ink-400">{p.accountName} · Property ID: {p.id}</p>
              </div>
            </label>
          ))}
          <button onClick={saveProperty} disabled={!selectedProp || saving}
            className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-colors mt-2">
            {saving ? 'Connecting...' : 'Connect this property →'}
          </button>
        </div>
      )}
    </div>
  )

  if (status === 'error') return (
    <div className="card p-6 text-center">
      <p className="text-red-500 text-sm">{data?.error}</p>
      <button onClick={fetchData} className="mt-3 text-xs px-3 py-1.5 bg-ink-100 rounded-lg">Retry</button>
    </div>
  )

  const { overview, chartData = [], topPages = [], sources = [], devices = [] } = data || {}
  const maxSessions = Math.max(...chartData.map(d => d.sessions), 1)
  const totalSources = sources.reduce((s, r) => s + r.sessions, 0)
  const totalDevices = devices.reduce((s, r) => s + r.sessions, 0)

  const tabs = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'pages', label: '📄 Top Pages' },
    { key: 'sources', label: '🔀 Traffic Sources' },
    { key: 'devices', label: '📱 Devices' },
  ] as const

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
          <span className="text-xs text-orange-600 font-medium">GA4 Connected</span>
          <span className="text-xs text-ink-400">· {data?.property?.name || data?.property?.id} · Last 28 days</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchProperties} className="text-xs px-3 py-1.5 bg-ink-100 rounded-lg hover:bg-ink-200 transition-colors">
            ⇄ Change property
          </button>
          <button onClick={fetchData} className="text-xs px-3 py-1.5 bg-ink-100 rounded-lg hover:bg-ink-200 transition-colors">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Sessions', value: overview.sessions.toLocaleString(), icon: '🔄', color: 'text-orange-600' },
            { label: 'Active Users', value: overview.activeUsers.toLocaleString(), icon: '👤', color: 'text-blue-600' },
            { label: 'Page Views', value: overview.pageViews.toLocaleString(), icon: '👁', color: 'text-violet-600' },
            { label: 'New Users', value: overview.newUsers.toLocaleString(), icon: '🆕', color: 'text-green-600' },
            { label: 'Bounce Rate', value: `${overview.bounceRate}%`, icon: '↩', color: overview.bounceRate < 50 ? 'text-green-600' : 'text-amber-500' },
            { label: 'Avg Session', value: formatDuration(overview.avgSessionDuration), icon: '⏱', color: 'text-teal-600' },
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
          <h3 className="font-semibold text-ink-900 mb-4">Sessions — last 28 days</h3>
          <div className="flex items-end gap-0.5 h-32">
            {chartData.map((d, i) => (
              <div key={i} className="flex-1 group relative">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-ink-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {d.date.slice(5)} · {d.sessions} sessions
                </div>
                <div className="w-full bg-orange-400 hover:bg-orange-500 rounded-t transition-colors"
                  style={{ height: `${Math.max(2, (d.sessions / maxSessions) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-ink-300 mt-1">
            <span>{chartData[0]?.date.slice(5)}</span>
            <span>{chartData[chartData.length - 1]?.date.slice(5)}</span>
          </div>
        </div>
      )}

      {/* Top Pages */}
      {activeTab === 'pages' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-ink-100"><h3 className="font-semibold text-ink-900">Top Pages by Views</h3></div>
          <table className="w-full text-sm">
            <thead><tr className="bg-ink-50 border-b border-ink-100">
              <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">Page</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Views</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Users</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Avg Time</th>
            </tr></thead>
            <tbody>
              {topPages.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-ink-300">No page data yet</td></tr>}
              {topPages.map((p, i) => (
                <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                  <td className="px-4 py-3 text-xs text-blue-600 max-w-xs truncate">{p.page}</td>
                  <td className="px-4 py-3 text-xs text-right font-medium">{p.pageViews.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-right text-ink-500">{p.users.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-right text-ink-500">{formatDuration(p.avgDuration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Traffic Sources */}
      {activeTab === 'sources' && (
        <div className="card p-5">
          <h3 className="font-semibold text-ink-900 mb-4">Traffic Sources</h3>
          {sources.length === 0 ? (
            <p className="text-center py-8 text-ink-300 text-sm">No source data yet</p>
          ) : (
            <div className="space-y-3">
              {sources.map((s, i) => {
                const pct = totalSources > 0 ? Math.round((s.sessions / totalSources) * 100) : 0
                const color = SOURCE_COLORS[s.source] || 'bg-gray-400'
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-ink-800">{s.source}</span>
                      <div className="flex items-center gap-3 text-xs text-ink-500">
                        <span>{s.sessions.toLocaleString()} sessions</span>
                        <span className="font-medium text-ink-900">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Devices */}
      {activeTab === 'devices' && (
        <div className="card p-5">
          <h3 className="font-semibold text-ink-900 mb-4">Device Breakdown</h3>
          {devices.length === 0 ? (
            <p className="text-center py-8 text-ink-300 text-sm">No device data yet</p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {devices.map((d, i) => {
                const pct = totalDevices > 0 ? Math.round((d.sessions / totalDevices) * 100) : 0
                const icons: Record<string, string> = { mobile: '📱', desktop: '🖥', tablet: '📲' }
                const colors: Record<string, string> = { mobile: 'text-blue-600', desktop: 'text-violet-600', tablet: 'text-teal-600' }
                return (
                  <div key={i} className="card p-4 text-center">
                    <div className="text-3xl mb-2">{icons[d.device.toLowerCase()] || '📊'}</div>
                    <p className="text-xs text-ink-400 capitalize mb-1">{d.device}</p>
                    <p className={`text-2xl font-bold ${colors[d.device.toLowerCase()] || 'text-ink-900'}`}>{pct}%</p>
                    <p className="text-xs text-ink-400 mt-1">{d.sessions.toLocaleString()} sessions</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
