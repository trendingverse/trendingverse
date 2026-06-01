'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface AdUnit {
  id: string; name: string; ad_type: string; position: string
  size_width: number; size_height: number; is_active: boolean
}
interface Publisher {
  id: string; email: string; full_name: string; plan: string
}
interface Site {
  id: string; name: string; site_url: string; user_id: string
}
interface PublisherAd {
  id: string; publisher_id: string; site_id: string; ad_unit_id: string
  is_enabled: boolean; revenue_share_pct: number; inject_after_paragraph: number
  ad_units: AdUnit; sites: Site
}

export function PublisherAdAssignment() {
  const [adUnits, setAdUnits] = useState<AdUnit[]>([])
  const [publishers, setPublishers] = useState<Publisher[]>([])
  const [assignments, setAssignments] = useState<PublisherAd[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [allSites, setAllSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(false)
  const [filterPublisher, setFilterPublisher] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [form, setForm] = useState({
    publisher_id: '',
    site_id: '',
    ad_unit_id: '',
    revenue_share_pct: 70,
    inject_after_paragraph: 2,
    is_enabled: true,
  })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [adRes, pubRes, assignRes, sitesRes] = await Promise.all([
      fetch('/api/monetization/ad-units'),
      fetch('/api/admin/publishers'),
      fetch('/api/monetization/publisher-ads'),
      fetch('/api/sites'),
    ])
    if (adRes.ok) setAdUnits(await adRes.json())
    if (pubRes.ok) {
      const data = await pubRes.json()
      setPublishers(data.publishers || [])
    }
    if (assignRes.ok) setAssignments(await assignRes.json())
    if (sitesRes.ok) {
      const data = await sitesRes.json()
      setAllSites(data)
      setSites(data)
    }
    setLoading(false)
  }

  function handlePublisherChange(publisherId: string) {
    setForm({...form, publisher_id: publisherId, site_id: ''})
    if (publisherId) {
      setSites(allSites.filter(s => s.user_id === publisherId))
    } else {
      setSites(allSites)
    }
  }

  async function assign() {
    if (!form.publisher_id || !form.ad_unit_id) {
      toast.error('Select publisher and ad unit')
      return
    }
    const res = await fetch('/api/monetization/publisher-ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      toast.success('Ad unit assigned!')
      fetchAll()
      setForm({ publisher_id: '', site_id: '', ad_unit_id: '', revenue_share_pct: 70, inject_after_paragraph: 2, is_enabled: true })
      setSites(allSites)
    } else {
      const data = await res.json()
      toast.error(data.error || 'Failed to assign')
    }
  }

  async function toggleAssignment(id: string, currentEnabled: boolean) {
    setTogglingId(id)
    const res = await fetch('/api/monetization/publisher-ads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_enabled: !currentEnabled }),
    })
    if (res.ok) {
      setAssignments(prev => prev.map(a => a.id === id ? {...a, is_enabled: !currentEnabled} : a))
      toast.success(!currentEnabled ? 'Ad enabled' : 'Ad paused')
    } else {
      toast.error('Failed to update')
    }
    setTogglingId(null)
  }

  async function deleteAssignment(id: string) {
    setDeletingId(id)
    const res = await fetch(`/api/monetization/publisher-ads?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAssignments(prev => prev.filter(a => a.id !== id))
      toast.success('Assignment removed')
    } else {
      toast.error('Failed to remove')
    }
    setDeletingId(null)
    setConfirmDeleteId(null)
  }

  const filteredAssignments = assignments.filter(a =>
    !filterPublisher || a.publisher_id === filterPublisher
  )

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-ink-900 mb-1">Assign Ad Units to Publishers</h3>
        <p className="text-xs text-ink-400">Control which ad units appear on each publisher site with custom revenue splits</p>
      </div>

      {/* Assignment form */}
      <div className="card p-5 space-y-4">
        <h4 className="font-medium text-ink-900 text-sm">New Assignment</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Publisher</label>
            <select className="input" value={form.publisher_id} onChange={e => handlePublisherChange(e.target.value)}>
              <option value="">Select publisher...</option>
              {publishers.map(p => (
                <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Site</label>
            <select className="input" value={form.site_id} onChange={e => setForm({...form, site_id: e.target.value})}>
              <option value="">All sites</option>
              {sites.length === 0 && form.publisher_id && (
                <option disabled>No sites found — publisher hasn't added a site yet</option>
              )}
              {sites.map(s => (
                <option key={s.id} value={s.id}>{s.name} — {s.site_url}</option>
              ))}
            </select>
            {form.publisher_id && sites.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">⚠ This publisher hasn't connected a site yet</p>
            )}
          </div>
          <div>
            <label className="label">Ad Unit</label>
            <select className="input" value={form.ad_unit_id} onChange={e => setForm({...form, ad_unit_id: e.target.value})}>
              <option value="">Select ad unit...</option>
              {adUnits.filter(a => a.is_active).map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.position} · {a.ad_type.toUpperCase()})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Revenue Share % (publisher gets)</label>
            <input type="number" min="0" max="100" className="input"
              value={form.revenue_share_pct}
              onChange={e => setForm({...form, revenue_share_pct: parseInt(e.target.value)})}/>
            <p className="text-xs text-ink-400 mt-1">
              Publisher: {form.revenue_share_pct}% · TrendingVerse: {100 - form.revenue_share_pct}%
            </p>
          </div>
          {adUnits.find(a => a.id === form.ad_unit_id)?.position === 'in_content' && (
            <div>
              <label className="label">Inject after paragraph #</label>
              <input type="number" min="1" max="20" className="input"
                value={form.inject_after_paragraph}
                onChange={e => setForm({...form, inject_after_paragraph: parseInt(e.target.value)})}/>
            </div>
          )}
          <div className="flex items-center gap-3 pt-4">
            <input type="checkbox" id="enabled" checked={form.is_enabled}
              onChange={e => setForm({...form, is_enabled: e.target.checked})}
              className="w-4 h-4 accent-accent"/>
            <label htmlFor="enabled" className="text-sm text-ink-700">Enabled immediately</label>
          </div>
        </div>
        <button onClick={assign} disabled={loading} className="btn-primary">
          Assign Ad Unit →
        </button>
      </div>

      {/* Current assignments */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-ink-100 flex items-center justify-between">
          <h4 className="font-medium text-ink-900 text-sm">
            Current Assignments ({filteredAssignments.length})
          </h4>
          <select className="input text-xs w-48" value={filterPublisher}
            onChange={e => setFilterPublisher(e.target.value)}>
            <option value="">All publishers</option>
            {publishers.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-ink-50 border-b border-ink-100">
              <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">Publisher</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">Site</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">Ad Unit</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">Position</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Rev share</th>
              <th className="text-center px-4 py-2 text-xs font-medium text-ink-500">Status</th>
              <th className="text-center px-4 py-2 text-xs font-medium text-ink-500">Actions</th>
            </tr></thead>
            <tbody>
              {filteredAssignments.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-ink-300 text-sm">No assignments yet</td></tr>
              )}
              {filteredAssignments.map((a) => (
                <tr key={a.id} className={`border-b border-ink-50 hover:bg-ink-50/50 ${!a.is_enabled ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 text-xs text-ink-700">
                    {publishers.find(p => p.id === a.publisher_id)?.email || a.publisher_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-500">
                    {a.site_id ? (allSites.find(s => s.id === a.site_id)?.name || 'Unknown') : (
                      <span className="text-amber-600 font-medium">⚠ All sites</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-ink-900">{a.ad_units?.name}</td>
                  <td className="px-4 py-3 text-xs text-ink-500">
                    {a.ad_units?.position}
                    {a.ad_units?.position === 'in_content' && ` (after ¶${a.inject_after_paragraph})`}
                  </td>
                  <td className="px-4 py-3 text-xs text-right">
                    <span className="text-green-600 font-medium">{a.revenue_share_pct}%</span>
                    <span className="text-ink-400"> pub</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleAssignment(a.id, a.is_enabled)}
                      disabled={togglingId === a.id}
                      className={`text-xs px-2 py-0.5 rounded-full transition-colors cursor-pointer ${
                        a.is_enabled
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
                      }`}>
                      {togglingId === a.id ? '...' : a.is_enabled ? 'Active' : 'Paused'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {confirmDeleteId === a.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => deleteAssignment(a.id)}
                          disabled={deletingId === a.id}
                          className="text-xs px-2 py-0.5 bg-red-500 text-white rounded-lg hover:bg-red-600">
                          {deletingId === a.id ? '...' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs px-2 py-0.5 bg-ink-100 text-ink-600 rounded-lg hover:bg-ink-200">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(a.id)}
                        className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        🗑 Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
