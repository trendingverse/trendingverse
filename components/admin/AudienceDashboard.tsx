'use client'
import { useState, useEffect } from 'react'

interface AudienceData {
  totals: { profiles: number; leads: number; mobile: number; desktop: number }
  deviceBreakdown: Record<string, number>
  genderBreakdown: Record<string, number>
  ageBreakdown: Record<string, number>
  topSites: { site: string; views: number }[]
  recentLeads: { email: string; name: string; city: string; gender: string; age_range: string; source_site: string; created_at: string }[]
  chartData: { date: string; views: number }[]
}

export function AudienceDashboard() {
  const [data, setData] = useState<AudienceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'leads'>('overview')

  useEffect(() => {
    fetch('/api/audience/dashboard')
      .then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-4">
      {Array(3).fill(0).map((_, i) => <div key={i} className="h-20 bg-ink-50 rounded-xl animate-pulse" />)}
    </div>
  )

  if (!data) return <div className="text-red-500 text-sm">Failed to load audience data</div>

  const { totals, deviceBreakdown, genderBreakdown, ageBreakdown, topSites, recentLeads, chartData } = data
  const maxViews = Math.max(...chartData.map(d => d.views), 1)

  function pct(val: number, total: number) {
    return total > 0 ? Math.round((val / total) * 100) : 0
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Profiles', value: totals.profiles.toLocaleString(), icon: '👥', color: 'text-blue-600' },
          { label: 'Email Leads', value: totals.leads.toLocaleString(), icon: '📧', color: 'text-green-600' },
          { label: 'Mobile Users', value: `${pct(totals.mobile, totals.profiles)}%`, icon: '📱', color: 'text-violet-600' },
          { label: 'Desktop Users', value: `${pct(totals.desktop, totals.profiles)}%`, icon: '💻', color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-ink-400">{s.label}</span>
              <span>{s.icon}</span>
            </div>
            <div className={`text-3xl font-display font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-ink-100 rounded-xl w-fit">
        {[{ key: 'overview', label: '📊 Overview' }, { key: 'leads', label: `📧 Leads (${totals.leads})` }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as 'overview' | 'leads')}
            className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${activeTab === t.key ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Pageviews chart */}
          <div className="card p-5">
            <h3 className="font-semibold text-ink-900 mb-4">Daily Pageviews — last 30 days</h3>
            {totals.profiles === 0 ? (
              <div className="text-center py-8">
                <p className="text-ink-300 text-sm">No data yet — install the plugin on publisher sites to start collecting</p>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-0.5 h-24 mb-2">
                  {chartData.map((d, i) => (
                    <div key={i} className="flex-1 group relative">
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-ink-900 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none z-10">
                        {d.date.slice(5)}: {d.views} views
                      </div>
                      <div className="w-full bg-blue-400 hover:bg-blue-500 rounded-t transition-colors"
                        style={{ height: `${Math.max(2, (d.views / maxViews) * 100)}%` }} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-ink-300">
                  <span>{chartData[0]?.date.slice(5)}</span>
                  <span>{chartData[chartData.length-1]?.date.slice(5)}</span>
                </div>
              </>
            )}
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            {/* Device breakdown */}
            <div className="card p-5">
              <h3 className="font-semibold text-ink-900 mb-4">Device Type</h3>
              <div className="space-y-3">
                {Object.entries(deviceBreakdown).map(([device, count]) => {
                  const total = Object.values(deviceBreakdown).reduce((a, b) => a + b, 0)
                  const p = pct(count, total)
                  return (
                    <div key={device}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-ink-700 capitalize">{device}</span>
                        <span className="text-ink-400">{count} ({p}%)</span>
                      </div>
                      <div className="h-2 bg-ink-100 rounded-full">
                        <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${p}%` }} />
                      </div>
                    </div>
                  )
                })}
                {Object.keys(deviceBreakdown).length === 0 && <p className="text-xs text-ink-300">No data yet</p>}
              </div>
            </div>

            {/* Gender breakdown */}
            <div className="card p-5">
              <h3 className="font-semibold text-ink-900 mb-4">Gender</h3>
              <div className="space-y-3">
                {Object.entries(genderBreakdown).map(([gender, count]) => {
                  const total = Object.values(genderBreakdown).reduce((a, b) => a + b, 0)
                  const p = pct(count, total)
                  const colors: Record<string, string> = { male: 'bg-blue-500', female: 'bg-pink-500', other: 'bg-violet-500' }
                  return (
                    <div key={gender}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-ink-700 capitalize">{gender}</span>
                        <span className="text-ink-400">{count} ({p}%)</span>
                      </div>
                      <div className="h-2 bg-ink-100 rounded-full">
                        <div className={`h-2 rounded-full ${colors[gender] || 'bg-gray-400'}`} style={{ width: `${p}%` }} />
                      </div>
                    </div>
                  )
                })}
                {Object.keys(genderBreakdown).length === 0 && <p className="text-xs text-ink-300">No data yet — collected from lead capture form</p>}
              </div>
            </div>

            {/* Age breakdown */}
            <div className="card p-5">
              <h3 className="font-semibold text-ink-900 mb-4">Age Range</h3>
              <div className="space-y-3">
                {Object.entries(ageBreakdown).sort().map(([age, count]) => {
                  const total = Object.values(ageBreakdown).reduce((a, b) => a + b, 0)
                  const p = pct(count, total)
                  return (
                    <div key={age}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-ink-700">{age}</span>
                        <span className="text-ink-400">{count} ({p}%)</span>
                      </div>
                      <div className="h-2 bg-ink-100 rounded-full">
                        <div className="h-2 bg-amber-500 rounded-full" style={{ width: `${p}%` }} />
                      </div>
                    </div>
                  )
                })}
                {Object.keys(ageBreakdown).length === 0 && <p className="text-xs text-ink-300">No data yet — collected from lead capture form</p>}
              </div>
            </div>
          </div>

          {/* Top publisher sites */}
          <div className="card p-5">
            <h3 className="font-semibold text-ink-900 mb-4">Top Publisher Sites by Pageviews</h3>
            {topSites.length === 0 ? (
              <p className="text-xs text-ink-300">No data yet</p>
            ) : (
              <div className="space-y-2">
                {topSites.map((s, i) => {
                  const maxV = topSites[0]?.views || 1
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-ink-400 w-4">{i+1}</span>
                      <span className="text-xs font-medium text-ink-900 w-48 truncate">{s.site}</span>
                      <div className="flex-1 h-2 bg-ink-100 rounded-full">
                        <div className="h-2 bg-red-400 rounded-full" style={{ width: `${pct(s.views, maxV)}%` }} />
                      </div>
                      <span className="text-xs text-ink-400 w-16 text-right">{s.views.toLocaleString()} views</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-ink-100">
            <h3 className="font-semibold text-ink-900">Email Leads — {totals.leads} collected</h3>
            <p className="text-xs text-ink-400 mt-1">Collected via lead capture popup on publisher sites</p>
          </div>
          {recentLeads.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-2xl mb-2">📧</p>
              <p className="text-sm text-ink-500">No leads yet — the popup will start collecting emails once the updated plugin is installed on publisher sites</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="bg-ink-50 border-b border-ink-100">
                <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">Email</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">Name</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">City</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-ink-500">Gender</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-ink-500">Age</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">Source Site</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Date</th>
              </tr></thead>
              <tbody>
                {recentLeads.map((l, i) => (
                  <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                    <td className="px-4 py-2.5 text-xs text-ink-900 font-medium">{l.email}</td>
                    <td className="px-4 py-2.5 text-xs text-ink-600">{l.name || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-ink-600">{l.city || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-center text-ink-600 capitalize">{l.gender || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-center text-ink-600">{l.age_range || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-blue-600 truncate max-w-xs">{l.source_site}</td>
                    <td className="px-4 py-2.5 text-xs text-ink-400 text-right whitespace-nowrap">
                      {new Date(l.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
