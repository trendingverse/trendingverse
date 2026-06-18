'use client'
import { useState, useEffect } from 'react'

interface AudienceData {
  totals: { profiles: number; leads: number; mobile: number; desktop: number }
  deviceBreakdown: Record<string, number>
  genderBreakdown: Record<string, number>
  ageBreakdown: Record<string, number>
  topCities: { city: string; count: number }[]
  topInterests: { interest: string; count: number }[]
  topSites: { site: string; views: number }[]
  recentLeads: { email: string; name: string; city: string; country: string; gender: string; age_range: string; source_site: string; created_at: string }[]
  chartData: { date: string; views: number }[]
}

interface ScrollStats {
  buckets: { label: string; count: number; percentage: number }[]
  avg_depth: number
  total_sessions: number
  by_page: { page: string; sessions: number; avg_depth: number; max_depth: number }[]
}

export function AudienceDashboard() {
  const [data, setData] = useState<AudienceData | null>(null)
  const [scrollStats, setScrollStats] = useState<ScrollStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [scrollLoading, setScrollLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'geo' | 'leads' | 'scroll'>('overview')
  const [selectedSite, setSelectedSite] = useState<string>('all')
  const [scrollDays, setScrollDays] = useState(7)
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailAddr, setEmailAddr] = useState('')
  const [showEmailInput, setShowEmailInput] = useState(false)

  useEffect(() => { loadData() }, [selectedSite, dateFrom, dateTo])
  useEffect(() => { if (activeTab === 'scroll') loadScrollStats() }, [activeTab, scrollDays, selectedSite])

  async function loadData() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo })
      if (selectedSite !== 'all') params.set('site', selectedSite)
      const res = await fetch(`/api/audience/dashboard?${params}`)
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  async function loadScrollStats() {
    setScrollLoading(true)
    try {
      const params = new URLSearchParams({ days: scrollDays.toString() })
      if (selectedSite !== 'all') params.set('site_url', selectedSite)
      const res = await fetch(`/api/audience/track/scroll-stats?${params}`)
      if (res.ok) setScrollStats(await res.json())
    } finally {
      setScrollLoading(false)
    }
  }

  function downloadCSV() {
    if (!data?.recentLeads?.length) return
    const headers = ['Email', 'Name', 'City', 'Gender', 'Age', 'Source Site', 'Date']
    const rows = data.recentLeads.map(l => [
      l.email, l.name || '', l.city || '', l.gender || '', l.age_range || '',
      l.source_site, new Date(l.created_at).toLocaleDateString('en-IN'),
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `trendingverse-audience-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  async function sendEmailReport() {
    if (!emailAddr) return
    setSendingEmail(true)
    try {
      const totals = data?.totals
      const html = `
        <h2>TrendingVerse Audience Report</h2>
        <p>Generated: ${new Date().toLocaleString('en-IN')}</p>
        <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">
          <tr style="background:#f3f4f6"><th>Metric</th><th>Value</th></tr>
          <tr><td>Total Profiles</td><td>${totals?.profiles?.toLocaleString()}</td></tr>
          <tr><td>Email Leads</td><td>${totals?.leads?.toLocaleString()}</td></tr>
          <tr><td>Mobile Users</td><td>${totals?.mobile?.toLocaleString()}</td></tr>
          <tr><td>Desktop Users</td><td>${totals?.desktop?.toLocaleString()}</td></tr>
        </table>
        <br/>
        <h3>Top Cities</h3>
        <table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">
          <tr style="background:#f3f4f6"><th>City</th><th>Visitors</th></tr>
          ${(data?.topCities || []).map(c => `<tr><td>${c.city}</td><td>${c.count}</td></tr>`).join('')}
        </table>`
      await fetch('/api/email/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailAddr,
          subject_override: `TrendingVerse Audience Report — ${new Date().toLocaleDateString('en-IN')}`,
          html_override: html,
        }),
      })
      alert(`Report sent to ${emailAddr}`)
      setShowEmailInput(false)
      setEmailAddr('')
    } catch { alert('Failed to send email') }
    setSendingEmail(false)
  }

  if (loading) return (
    <div className="space-y-4">
      {Array(3).fill(0).map((_, i) => <div key={i} className="h-20 bg-ink-50 rounded-xl animate-pulse" />)}
    </div>
  )
  if (!data) return <div className="text-red-500 text-sm">Failed to load audience data</div>

  const { totals, deviceBreakdown, genderBreakdown, ageBreakdown, topCities, topInterests, topSites, recentLeads, chartData } = data
  const maxViews = Math.max(...chartData.map(d => d.views), 1)

  function pct(val: number, total: number) {
    return total > 0 ? Math.round((val / total) * 100) : 0
  }

  // Scroll depth color based on depth value
  function depthColor(depth: number) {
    if (depth >= 75) return 'text-green-600'
    if (depth >= 50) return 'text-amber-600'
    return 'text-red-500'
  }

  function depthBg(depth: number) {
    if (depth >= 75) return 'bg-green-500'
    if (depth >= 50) return 'bg-amber-500'
    return 'bg-red-400'
  }

  return (
    <div className="space-y-5">

      {/* Header controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <select className="input text-xs w-52" value={selectedSite} onChange={e => setSelectedSite(e.target.value)}>
            <option value="all">All publisher sites</option>
            {topSites.map(s => (
              <option key={s.site} value={s.site}>{s.site}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input type="date" className="input text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <span className="text-xs text-ink-400">to</span>
            <input type="date" className="input text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="flex gap-1 p-1 bg-ink-100 rounded-xl">
            {[
              { l: '7d', days: 7 }, { l: '30d', days: 30 },
              { l: '90d', days: 90 }, { l: 'All', days: 365 },
            ].map(opt => (
              <button key={opt.l} onClick={() => {
                const to = new Date().toISOString().split('T')[0]
                const from = new Date(Date.now() - opt.days * 86400000).toISOString().split('T')[0]
                setDateFrom(from); setDateTo(to)
              }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors bg-white shadow text-ink-900 hover:bg-ink-50">
                {opt.l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadCSV} disabled={!data?.recentLeads?.length}
            className="text-xs px-3 py-1.5 bg-ink-100 text-ink-700 rounded-lg hover:bg-ink-200 font-medium disabled:opacity-40">
            ⬇ Download CSV
          </button>
          <div className="relative">
            <button onClick={() => setShowEmailInput(!showEmailInput)}
              className="text-xs px-3 py-1.5 bg-ink-900 text-white rounded-lg hover:bg-ink-800 font-medium">
              📧 Email Report
            </button>
            {showEmailInput && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowEmailInput(false)} />
                <div className="absolute right-0 top-9 w-64 bg-white border border-ink-100 rounded-xl shadow-lg z-20 p-3 space-y-2">
                  <input type="email" className="input text-xs w-full" placeholder="email@example.com"
                    value={emailAddr} onChange={e => setEmailAddr(e.target.value)} />
                  <button onClick={sendEmailReport} disabled={!emailAddr || sendingEmail}
                    className="w-full text-xs py-1.5 bg-accent text-white rounded-lg disabled:opacity-50">
                    {sendingEmail ? 'Sending...' : 'Send Report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

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
        {[
          { key: 'overview', label: '📊 Overview' },
          { key: 'geo', label: '📍 Geo' },
          { key: 'leads', label: `📧 Leads (${totals.leads})` },
          { key: 'scroll', label: '📜 Scroll Depth' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${activeTab === t.key ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold text-ink-900 mb-4">Daily Pageviews — last 30 days</h3>
            {totals.profiles === 0 ? (
              <p className="text-center py-8 text-ink-300 text-sm">No data yet — install plugin on publisher sites</p>
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
                  <span>{chartData[chartData.length - 1]?.date.slice(5)}</span>
                </div>
              </>
            )}
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
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
                {Object.keys(genderBreakdown).length === 0 && <p className="text-xs text-ink-300">No gender data yet</p>}
              </div>
            </div>

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
                {Object.keys(ageBreakdown).length === 0 && <p className="text-xs text-ink-300">No age data yet</p>}
              </div>
            </div>
          </div>

          {topInterests && topInterests.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-ink-900 mb-4">Top Content Interests</h3>
              <div className="flex flex-wrap gap-2">
                {topInterests.map((t, i) => (
                  <span key={i} className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full font-medium">
                    {t.interest} <span className="text-blue-400 ml-1">{t.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="card p-5">
            <h3 className="font-semibold text-ink-900 mb-4">Top Publisher Sites</h3>
            {topSites.length === 0 ? (
              <p className="text-xs text-ink-300">No data yet</p>
            ) : (
              <div className="space-y-2">
                {topSites.map((s, i) => {
                  const maxV = topSites[0]?.views || 1
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-ink-400 w-4">{i + 1}</span>
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

      {/* GEO TAB */}
      {activeTab === 'geo' && (
        <div className="space-y-5">
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="card p-5">
              <h3 className="font-semibold text-ink-900 mb-4">📍 Top Cities</h3>
              {!topCities || topCities.length === 0 ? (
                <p className="text-xs text-ink-300">No geo data yet</p>
              ) : (
                <div className="space-y-2">
                  {topCities.map((c, i) => {
                    const maxC = topCities[0]?.count || 1
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-ink-400 w-4">{i + 1}</span>
                        <span className="text-xs font-medium text-ink-900 w-32 truncate">{c.city || 'Unknown'}</span>
                        <div className="flex-1 h-2 bg-ink-100 rounded-full">
                          <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${pct(c.count, maxC)}%` }} />
                        </div>
                        <span className="text-xs text-ink-400 w-12 text-right">{c.count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="card p-5">
              <h3 className="font-semibold text-ink-900 mb-4">🗺 City Distribution</h3>
              {!topCities || topCities.length === 0 ? (
                <p className="text-xs text-ink-300">No geo data yet</p>
              ) : (
                <table className="w-full text-xs">
                  <thead><tr className="bg-ink-50 border-b border-ink-100">
                    <th className="text-left px-3 py-2 font-medium text-ink-500">City</th>
                    <th className="text-right px-3 py-2 font-medium text-ink-500">Visitors</th>
                    <th className="text-right px-3 py-2 font-medium text-ink-500">Share</th>
                  </tr></thead>
                  <tbody>
                    {topCities.map((c, i) => {
                      const total = topCities.reduce((s, x) => s + x.count, 0)
                      return (
                        <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                          <td className="px-3 py-2 text-ink-900 font-medium">{c.city || 'Unknown'}</td>
                          <td className="px-3 py-2 text-right text-ink-600">{c.count}</td>
                          <td className="px-3 py-2 text-right text-ink-400">{pct(c.count, total)}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold text-ink-900 mb-2">🇮🇳 Reader Geography</h3>
            <p className="text-xs text-ink-400 mb-4">Readers detected across India based on IP location</p>
            {!topCities || topCities.length === 0 ? (
              <p className="text-xs text-ink-300 text-center py-8">No geo data yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {topCities.map((c, i) => {
                  const maxC = topCities[0]?.count || 1
                  const size = Math.max(0.7, (c.count / maxC))
                  const colors = ['bg-blue-500', 'bg-red-500', 'bg-green-500', 'bg-violet-500', 'bg-amber-500', 'bg-teal-500', 'bg-pink-500', 'bg-indigo-500']
                  return (
                    <div key={i} className={`${colors[i % colors.length]} rounded-full flex items-center justify-center text-white font-semibold cursor-default`}
                      style={{ width: `${Math.max(48, size * 80)}px`, height: `${Math.max(48, size * 80)}px`, fontSize: `${Math.max(9, size * 13)}px` }}
                      title={`${c.city}: ${c.count} visitors`}>
                      {c.city?.split(' ')[0]?.slice(0, 8) || '?'}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* LEADS TAB */}
      {activeTab === 'leads' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-ink-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-ink-900">Email Leads — {totals.leads} collected</h3>
              <p className="text-xs text-ink-400 mt-0.5">Collected via inline subscribe bar on publisher sites</p>
            </div>
            {recentLeads.length > 0 && (
              <button onClick={downloadCSV}
                className="text-xs px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium">
                ⬇ Export CSV
              </button>
            )}
          </div>
          {recentLeads.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-2xl mb-2">📧</p>
              <p className="text-sm text-ink-500">No leads yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-ink-50 border-b border-ink-100">
                  <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">Email</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">City</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">Country</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-ink-500">Gender</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-ink-500">Age</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">Source Site</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Date</th>
                </tr></thead>
                <tbody>
                  {recentLeads.map((l, i) => (
                    <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                      <td className="px-4 py-2.5 text-xs text-ink-900 font-medium">{l.email}</td>
                      <td className="px-4 py-2.5 text-xs text-ink-600">{l.city || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-ink-600">{l.country || '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-center capitalize">{l.gender || '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-center">{l.age_range || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-blue-600 truncate max-w-xs">{l.source_site}</td>
                      <td className="px-4 py-2.5 text-xs text-ink-400 text-right whitespace-nowrap">
                        {new Date(l.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SCROLL DEPTH TAB */}
      {activeTab === 'scroll' && (
        <div className="space-y-5">
          {/* Controls */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold text-ink-900">📜 Scroll Depth Analysis</p>
              <p className="text-xs text-ink-400">How far readers scroll on your pages — use this to optimize ad placement</p>
            </div>
            <div className="flex gap-1 p-1 bg-ink-100 rounded-xl">
              {[7, 14, 30].map(d => (
                <button key={d} onClick={() => setScrollDays(d)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${scrollDays === d ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {scrollLoading ? (
            <div className="h-32 bg-ink-50 rounded-xl animate-pulse" />
          ) : !scrollStats || scrollStats.total_sessions === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-2xl mb-2">📜</p>
              <p className="text-sm text-ink-500 mb-1">No scroll data yet</p>
              <p className="text-xs text-ink-400">Scroll tracking starts once the updated plugin is active on publisher sites</p>
            </div>
          ) : (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="card p-4 text-center">
                  <p className={`text-3xl font-bold ${depthColor(scrollStats.avg_depth)}`}>{scrollStats.avg_depth}%</p>
                  <p className="text-xs text-ink-400 mt-1">Avg Scroll Depth</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-3xl font-bold text-ink-900">{scrollStats.total_sessions.toLocaleString()}</p>
                  <p className="text-xs text-ink-400 mt-1">Sessions Tracked</p>
                </div>
                <div className="card p-4 text-center">
                  <p className={`text-3xl font-bold ${depthColor(scrollStats.buckets.find(b => b.label === '75-90%' || b.label === '90-100%')?.percentage || 0)}`}>
                    {(scrollStats.buckets.filter(b => b.min >= 75).reduce((s, b) => s + b.count, 0) / scrollStats.total_sessions * 100).toFixed(0)}%
                  </p>
                  <p className="text-xs text-ink-400 mt-1">Read 75%+ of page</p>
                </div>
              </div>

              {/* Depth funnel */}
              <div className="card p-5">
                <h3 className="font-semibold text-ink-900 mb-2">Scroll Depth Funnel</h3>
                <p className="text-xs text-ink-400 mb-4">What % of sessions reach each scroll milestone</p>
                <div className="space-y-3">
                  {scrollStats.buckets.map((b, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink-800">{b.label}</span>
                          {b.label === '0-25%' && <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full">Bounced / skimmed</span>}
                          {b.label === '50-75%' && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">Engaged reader</span>}
                          {b.label === '90-100%' && <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full">Deep reader</span>}
                        </div>
                        <span className="text-ink-400">{b.count} sessions ({b.percentage}%)</span>
                      </div>
                      <div className="h-3 bg-ink-100 rounded-full overflow-hidden">
                        <div className={`h-3 rounded-full transition-all ${depthBg(b.min + 12)}`}
                          style={{ width: `${b.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Ad placement insight */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <p className="text-xs font-semibold text-blue-800 mb-1">💡 Ad Placement Insight</p>
                  <p className="text-xs text-blue-700">
                    {scrollStats.avg_depth >= 70
                      ? `Great engagement! ${scrollStats.avg_depth}% avg scroll — footer ads are being seen. In-content + footer strategy is working well.`
                      : scrollStats.avg_depth >= 45
                      ? `Moderate engagement at ${scrollStats.avg_depth}% avg scroll. Consider moving ads higher — in-content after paragraph 2-3 will get more views than footer.`
                      : `Low engagement at ${scrollStats.avg_depth}% avg scroll. Most readers leave early — place ads in header and after para 1-2 for maximum visibility.`}
                  </p>
                </div>
              </div>

              {/* By page table */}
              {scrollStats.by_page.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink-900">Scroll Depth by Page</p>
                    <p className="text-xs text-ink-400">Top {scrollStats.by_page.length} pages</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-ink-50 border-b border-ink-100">
                        <th className="text-left px-4 py-2.5 font-medium text-ink-500">Page URL</th>
                        <th className="text-center px-3 py-2.5 font-medium text-ink-500">Sessions</th>
                        <th className="text-center px-3 py-2.5 font-medium text-ink-500">Avg Depth</th>
                        <th className="text-center px-3 py-2.5 font-medium text-ink-500">Max Depth</th>
                        <th className="text-center px-3 py-2.5 font-medium text-ink-500">Engagement</th>
                      </tr></thead>
                      <tbody>
                        {scrollStats.by_page.map((p, i) => (
                          <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                            <td className="px-4 py-2.5 text-ink-700 truncate max-w-xs">
                              <a href={p.page} target="_blank" rel="noreferrer" className="hover:text-blue-600 hover:underline">
                                {p.page.replace(/^https?:\/\/[^/]+/, '') || '/'}
                              </a>
                            </td>
                            <td className="px-3 py-2.5 text-center text-ink-600">{p.sessions}</td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`font-semibold ${depthColor(p.avg_depth)}`}>{p.avg_depth}%</span>
                            </td>
                            <td className="px-3 py-2.5 text-center text-ink-600">{p.max_depth}%</td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="w-20 h-2 bg-ink-100 rounded-full mx-auto">
                                <div className={`h-2 rounded-full ${depthBg(p.avg_depth)}`} style={{ width: `${p.avg_depth}%` }} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
