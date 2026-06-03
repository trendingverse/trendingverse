'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface Segment {
  id: string; name: string; description: string
  conditions: { cities?: string[]; devices?: string[]; interests?: string[]; min_page_views?: number }
  is_active: boolean; profile_count: number
}

interface DirectAd {
  id: string; name: string; ad_type: string
  headline: string; description: string; image_url: string
  cta_text: string; destination_url: string
  segment_ids: string[]; target_all: boolean
  position: string; size_width: number; size_height: number
  daily_budget_inr: number; start_date: string; end_date: string
  impressions: number; clicks: number; is_active: boolean
}

const CITIES = ['Bengaluru', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad', 'Mangaluru', 'Mysuru', 'Gurugram', 'Noida']
const DEVICES = ['mobile', 'desktop', 'tablet']
const INTERESTS = ['Karnataka', 'Politics', 'Entertainment', 'Sports', 'Technology', 'Business', 'Health', 'Education', 'Astro', 'Crime', 'Local News']

export function DirectAdsPanel() {
  const [segments, setSegments] = useState<Segment[]>([])
  const [ads, setAds] = useState<DirectAd[]>([])
  const [activeTab, setActiveTab] = useState<'ads' | 'segments'>('ads')
  const [showAdForm, setShowAdForm] = useState(false)
  const [showSegForm, setShowSegForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [adForm, setAdForm] = useState({
    name: '', ad_type: 'banner', headline: '', description: '',
    image_url: '', cta_text: 'Learn More', destination_url: '',
    segment_ids: [] as string[], target_all: false,
    position: 'in_content', size_width: 300, size_height: 250,
    daily_budget_inr: 0, start_date: '', end_date: '',
  })

  const [segForm, setSegForm] = useState({
    name: '', description: '',
    conditions: { cities: [] as string[], devices: [] as string[], interests: [] as string[], min_page_views: 0 },
  })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [segsRes, adsRes] = await Promise.all([
      fetch('/api/audience/segments'),
      fetch('/api/audience/direct-ads'),
    ])
    if (segsRes.ok) setSegments(await segsRes.json())
    if (adsRes.ok) setAds(await adsRes.json())
    setLoading(false)
  }

  async function saveAd() {
    const res = await fetch('/api/audience/direct-ads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adForm),
    })
    if (res.ok) { toast.success('Ad created!'); setShowAdForm(false); fetchAll() }
    else toast.error('Failed to create ad')
  }

  async function saveSeg() {
    if (!segForm.name) { toast.error('Segment name required'); return }
    const res = await fetch('/api/audience/segments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(segForm),
    })
    if (res.ok) { toast.success('Segment created!'); setShowSegForm(false); fetchAll() }
    else toast.error('Failed to create segment')
  }

  async function toggleAd(id: string, current: boolean) {
    await fetch('/api/audience/direct-ads', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !current }),
    })
    setAds(prev => prev.map(a => a.id === id ? { ...a, is_active: !current } : a))
    toast.success(!current ? 'Ad activated' : 'Ad paused')
  }

  async function deleteAd(id: string) {
    setDeletingId(id)
    await fetch(`/api/audience/direct-ads?id=${id}`, { method: 'DELETE' })
    setAds(prev => prev.filter(a => a.id !== id))
    toast.success('Ad deleted')
    setDeletingId(null)
  }

  function toggleCondition(field: 'cities' | 'devices' | 'interests', val: string) {
    const arr = segForm.conditions[field] as string[]
    const updated = arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
    setSegForm(f => ({ ...f, conditions: { ...f.conditions, [field]: updated } }))
  }

  function toggleSegmentOnAd(segId: string) {
    const ids = adForm.segment_ids
    setAdForm(f => ({ ...f, segment_ids: ids.includes(segId) ? ids.filter(x => x !== segId) : [...ids, segId] }))
  }

  const ctr = (ad: DirectAd) => ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '0.0'

  if (loading) return <div className="h-24 bg-ink-50 rounded-xl animate-pulse" />

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 p-1 bg-ink-100 rounded-xl">
          {[{ key: 'ads', label: `🎯 Direct Ads (${ads.length})` }, { key: 'segments', label: `👥 Audience Segments (${segments.length})` }].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as 'ads' | 'segments')}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${activeTab === t.key ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={() => activeTab === 'ads' ? setShowAdForm(true) : setShowSegForm(true)}
          className="btn-primary text-xs px-4 py-2">
          + {activeTab === 'ads' ? 'Create Ad' : 'Create Segment'}
        </button>
      </div>

      {/* ── SEGMENTS TAB ── */}
      {activeTab === 'segments' && (
        <div className="space-y-4">
          {showSegForm && (
            <div className="card p-5 space-y-4 border-2 border-accent/20">
              <h3 className="font-semibold text-ink-900">New Audience Segment</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Segment Name *</label>
                  <input className="input" value={segForm.name} onChange={e => setSegForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Bengaluru Mobile Readers" />
                </div>
                <div>
                  <label className="label">Description</label>
                  <input className="input" value={segForm.description} onChange={e => setSegForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
                </div>
              </div>

              <div>
                <label className="label">Target Cities</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {CITIES.map(c => (
                    <button key={c} onClick={() => toggleCondition('cities', c)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${segForm.conditions.cities?.includes(c) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-ink-600 border-ink-200 hover:border-blue-400'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Target Devices</label>
                <div className="flex gap-2 mt-1">
                  {DEVICES.map(d => (
                    <button key={d} onClick={() => toggleCondition('devices', d)}
                      className={`text-xs px-3 py-1.5 rounded-lg border capitalize transition-colors ${segForm.conditions.devices?.includes(d) ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-ink-600 border-ink-200 hover:border-violet-400'}`}>
                      {d === 'mobile' ? '📱' : d === 'desktop' ? '💻' : '📟'} {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Target Interests</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {INTERESTS.map(i => (
                    <button key={i} onClick={() => toggleCondition('interests', i)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${segForm.conditions.interests?.includes(i) ? 'bg-green-600 text-white border-green-600' : 'bg-white text-ink-600 border-ink-200 hover:border-green-400'}`}>
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-48">
                <label className="label">Min. Page Views</label>
                <input type="number" className="input" min={0} value={segForm.conditions.min_page_views}
                  onChange={e => setSegForm(f => ({ ...f, conditions: { ...f.conditions, min_page_views: parseInt(e.target.value) || 0 } }))} />
                <p className="text-xs text-ink-400 mt-1">Only target engaged readers</p>
              </div>

              <div className="flex gap-3">
                <button onClick={saveSeg} className="btn-primary">Save Segment</button>
                <button onClick={() => setShowSegForm(false)} className="px-4 py-2 text-sm bg-ink-100 text-ink-600 rounded-xl">Cancel</button>
              </div>
            </div>
          )}

          {segments.length === 0 && !showSegForm ? (
            <div className="card p-8 text-center">
              <p className="text-2xl mb-2">👥</p>
              <p className="text-sm text-ink-500">No segments yet — create one to start targeting specific reader groups</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {segments.map(seg => (
                <div key={seg.id} className="card p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-ink-900">{seg.name}</p>
                      {seg.description && <p className="text-xs text-ink-400 mt-0.5">{seg.description}</p>}
                    </div>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      {seg.profile_count} readers
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {seg.conditions.cities?.map(c => <span key={c} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">📍 {c}</span>)}
                    {seg.conditions.devices?.map(d => <span key={d} className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full capitalize">📱 {d}</span>)}
                    {seg.conditions.interests?.map(i => <span key={i} className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">🏷 {i}</span>)}
                    {seg.conditions.min_page_views ? <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">⏱ {seg.conditions.min_page_views}+ views</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ADS TAB ── */}
      {activeTab === 'ads' && (
        <div className="space-y-4">
          {showAdForm && (
            <div className="card p-5 space-y-4 border-2 border-accent/20">
              <h3 className="font-semibold text-ink-900">Create Direct Ad</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Ad Name *</label>
                  <input className="input" value={adForm.name} onChange={e => setAdForm(f => ({ ...f, name: e.target.value }))} placeholder="Internal name for this ad" />
                </div>
                <div>
                  <label className="label">Ad Type</label>
                  <select className="input" value={adForm.ad_type} onChange={e => setAdForm(f => ({ ...f, ad_type: e.target.value }))}>
                    <option value="banner">Banner (Image)</option>
                    <option value="text">Text Ad</option>
                    <option value="native">Native (Image + Text)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Headline</label>
                  <input className="input" value={adForm.headline} onChange={e => setAdForm(f => ({ ...f, headline: e.target.value }))} placeholder="Ad headline" />
                </div>
                <div>
                  <label className="label">CTA Text</label>
                  <input className="input" value={adForm.cta_text} onChange={e => setAdForm(f => ({ ...f, cta_text: e.target.value }))} placeholder="Learn More" />
                </div>
                <div className="col-span-2">
                  <label className="label">Description</label>
                  <textarea className="input resize-none" rows={2} value={adForm.description} onChange={e => setAdForm(f => ({ ...f, description: e.target.value }))} placeholder="Ad description text" />
                </div>
                <div className="col-span-2">
                  <label className="label">Image URL</label>
                  <input className="input" value={adForm.image_url} onChange={e => setAdForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://example.com/image.jpg" />
                </div>
                <div className="col-span-2">
                  <label className="label">Destination URL *</label>
                  <input className="input" value={adForm.destination_url} onChange={e => setAdForm(f => ({ ...f, destination_url: e.target.value }))} placeholder="https://advertiser-website.com" />
                </div>
                <div>
                  <label className="label">Position</label>
                  <select className="input" value={adForm.position} onChange={e => setAdForm(f => ({ ...f, position: e.target.value }))}>
                    <option value="header">Header</option>
                    <option value="in_content">In Content</option>
                    <option value="footer">Footer</option>
                  </select>
                </div>
                <div>
                  <label className="label">Daily Budget (₹)</label>
                  <input type="number" className="input" value={adForm.daily_budget_inr} onChange={e => setAdForm(f => ({ ...f, daily_budget_inr: parseInt(e.target.value) || 0 }))} placeholder="0 = unlimited" />
                </div>
                <div>
                  <label className="label">Start Date</label>
                  <input type="date" className="input" value={adForm.start_date} onChange={e => setAdForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input type="date" className="input" value={adForm.end_date} onChange={e => setAdForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>

              {/* Targeting */}
              <div>
                <label className="label">Targeting</label>
                <div className="flex items-center gap-3 mb-3">
                  <input type="checkbox" id="target_all" checked={adForm.target_all}
                    onChange={e => setAdForm(f => ({ ...f, target_all: e.target.checked }))}
                    className="w-4 h-4 accent-accent" />
                  <label htmlFor="target_all" className="text-sm text-ink-700">Show to all visitors (no targeting)</label>
                </div>
                {!adForm.target_all && segments.length > 0 && (
                  <div>
                    <p className="text-xs text-ink-400 mb-2">Select audience segments to target:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {segments.map(seg => (
                        <button key={seg.id} onClick={() => toggleSegmentOnAd(seg.id)}
                          className={`text-left p-3 rounded-xl border text-xs transition-colors ${adForm.segment_ids.includes(seg.id) ? 'border-accent bg-accent/5' : 'border-ink-100 hover:border-ink-200'}`}>
                          <p className="font-medium text-ink-900">{seg.name}</p>
                          <p className="text-ink-400">{seg.profile_count} matching readers</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!adForm.target_all && segments.length === 0 && (
                  <p className="text-xs text-amber-600">Create audience segments first to target specific readers</p>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={saveAd} className="btn-primary">Create Ad</button>
                <button onClick={() => setShowAdForm(false)} className="px-4 py-2 text-sm bg-ink-100 text-ink-600 rounded-xl">Cancel</button>
              </div>
            </div>
          )}

          {ads.length === 0 && !showAdForm ? (
            <div className="card p-8 text-center">
              <p className="text-2xl mb-2">🎯</p>
              <p className="text-sm text-ink-500">No direct ads yet — create your first targeted ad campaign</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-ink-50 border-b border-ink-100">
                  <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">Ad</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-ink-500">Type</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-ink-500">Targeting</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-ink-500">Impressions</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-ink-500">Clicks</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-ink-500">CTR</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-ink-500">Status</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-ink-500">Actions</th>
                </tr></thead>
                <tbody>
                  {ads.map(ad => (
                    <tr key={ad.id} className={`border-b border-ink-50 hover:bg-ink-50/50 ${!ad.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-ink-900">{ad.name}</p>
                        <p className="text-xs text-ink-400 truncate max-w-xs">{ad.headline || ad.destination_url}</p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="text-xs bg-ink-100 text-ink-600 px-2 py-0.5 rounded-full capitalize">{ad.ad_type}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {ad.target_all ? (
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">All visitors</span>
                        ) : (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{ad.segment_ids?.length || 0} segments</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right text-xs text-ink-600">{(ad.impressions || 0).toLocaleString()}</td>
                      <td className="px-3 py-3 text-right text-xs text-ink-600">{(ad.clicks || 0).toLocaleString()}</td>
                      <td className="px-3 py-3 text-right text-xs font-medium text-green-600">{ctr(ad)}%</td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => toggleAd(ad.id, ad.is_active)}
                          className={`text-xs px-2 py-0.5 rounded-full ${ad.is_active ? 'bg-green-100 text-green-700' : 'bg-ink-100 text-ink-500'}`}>
                          {ad.is_active ? 'Active' : 'Paused'}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => deleteAd(ad.id)} disabled={deletingId === ad.id}
                          className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg">
                          {deletingId === ad.id ? '...' : '🗑'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
