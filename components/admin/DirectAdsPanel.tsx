'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface Segment {
  id: string; name: string; description: string
  conditions: {
    countries?: string[]; states?: string[]; cities?: string[]
    devices?: string[]; interests?: string[]; min_page_views?: number
  }
  is_active: boolean; profile_count: number
}

interface AdSlot {
  id: string; name: string; position: string; ad_type: string
  ad_code: string; size_width: number; size_height: number; is_enabled: boolean
}

interface DirectAd {
  id: string; name: string; campaign_name: string; campaign_notes: string
  ad_type: string; headline: string; description: string; image_url: string
  cta_text: string; destination_url: string; ad_slot_id?: string
  segment_ids: string[]; target_all: boolean
  position: string; size_width: number; size_height: number
  priority: number; cpm_rate_inr: number; total_budget_inr: number; impressions_cap: number
  start_date: string; end_date: string
  impressions: number; clicks: number; is_active: boolean
}

const COUNTRIES = ['India', 'United States', 'United Kingdom', 'UAE', 'Canada', 'Australia']
const INDIAN_STATES = ['Karnataka', 'Tamil Nadu', 'Andhra Pradesh', 'Telangana', 'Kerala', 'Maharashtra', 'Gujarat', 'West Bengal', 'Punjab', 'Rajasthan', 'Uttar Pradesh', 'Bihar', 'Delhi', 'Haryana', 'Madhya Pradesh', 'Odisha', 'Assam', 'Goa', 'Jharkhand', 'Himachal Pradesh']
const CITIES = ['Bengaluru', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad', 'Mangaluru', 'Mysuru', 'Gurugram', 'Noida', 'Surat', 'Jaipur', 'Lucknow', 'Kochi', 'Coimbatore', 'Visakhapatnam']
const DEVICES = ['mobile', 'desktop', 'tablet']
const INTERESTS = ['Karnataka', 'Politics', 'Entertainment', 'Sports', 'Technology', 'Business', 'Health', 'Education', 'Astro', 'Crime', 'Local News']

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-100 text-green-700',
  scheduled: 'bg-blue-100 text-blue-700',
  ended:     'bg-ink-100 text-ink-500',
  paused:    'bg-amber-100 text-amber-700',
}

function getCampaignStatus(ad: DirectAd): string {
  if (!ad.is_active) return 'paused'
  const today = new Date().toISOString().split('T')[0]
  if (ad.start_date && ad.start_date > today) return 'scheduled'
  if (ad.end_date && ad.end_date < today) return 'ended'
  return 'active'
}

const EMPTY_AD = {
  name: '', campaign_name: '', campaign_notes: '',
  ad_type: 'existing', headline: '', description: '',
  image_url: '', cta_text: 'Learn More', destination_url: '',
  ad_slot_id: '',
  segment_ids: [] as string[], target_all: false,
  position: 'in_content', size_width: 300, size_height: 250,
  priority: 0, cpm_rate_inr: 0, total_budget_inr: 0, impressions_cap: 0,
  start_date: '', end_date: '',
}

const EMPTY_SEG = {
  name: '', description: '',
  conditions: {
    countries: [] as string[], states: [] as string[], cities: [] as string[],
    devices: [] as string[], interests: [] as string[], min_page_views: 0,
  },
}

export function DirectAdsPanel() {
  const [segments, setSegments] = useState<Segment[]>([])
  const [ads, setAds] = useState<DirectAd[]>([])
  const [adSlots, setAdSlots] = useState<AdSlot[]>([])
  const [activeTab, setActiveTab] = useState<'campaigns' | 'segments'>('campaigns')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showAdForm, setShowAdForm] = useState(false)
  const [showSegForm, setShowSegForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [adForm, setAdForm] = useState({ ...EMPTY_AD })
  const [segForm, setSegForm] = useState({ ...EMPTY_SEG })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [segsRes, adsRes, slotsRes] = await Promise.all([
      fetch('/api/audience/segments'),
      fetch('/api/audience/direct-ads'),
      fetch('/api/adslots'),
    ])
    if (segsRes.ok) setSegments(await segsRes.json())
    if (adsRes.ok) setAds(await adsRes.json())
    if (slotsRes.ok) {
      const slots = await slotsRes.json()
      setAdSlots(Array.isArray(slots) ? slots : [])
    }
    setLoading(false)
  }

  async function saveAd() {
    if (!adForm.campaign_name) { toast.error('Campaign name required'); return }
    if (adForm.ad_type !== 'existing' && !adForm.destination_url) { toast.error('Destination URL required'); return }
    if (adForm.ad_type === 'existing' && !adForm.ad_slot_id) { toast.error('Select an ad unit'); return }

    const payload = { ...adForm, name: adForm.campaign_name }

    // If using existing ad slot, copy slot details
    if (adForm.ad_type === 'existing' && adForm.ad_slot_id) {
      const slot = adSlots.find(s => s.id === adForm.ad_slot_id)
      if (slot) {
        payload.position = slot.position
        payload.size_width = slot.size_width || 300
        payload.size_height = slot.size_height || 250
      }
    }

    const res = await fetch('/api/audience/direct-ads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      toast.success('Campaign created!')
      setShowAdForm(false)
      setAdForm({ ...EMPTY_AD })
      fetchAll()
    } else toast.error('Failed to create campaign')
  }

  async function saveSeg() {
    if (!segForm.name) { toast.error('Segment name required'); return }
    const res = await fetch('/api/audience/segments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(segForm),
    })
    if (res.ok) {
      toast.success('Segment created!')
      setShowSegForm(false)
      setSegForm({ ...EMPTY_SEG })
      fetchAll()
    } else toast.error('Failed to create segment')
  }

  async function toggleAd(id: string, current: boolean) {
    await fetch('/api/audience/direct-ads', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !current }),
    })
    setAds(prev => prev.map(a => a.id === id ? { ...a, is_active: !current } : a))
    toast.success(!current ? 'Campaign activated' : 'Campaign paused')
  }

  async function deleteAd(id: string) {
    if (!confirm('Delete this campaign?')) return
    await fetch(`/api/audience/direct-ads?id=${id}`, { method: 'DELETE' })
    setAds(prev => prev.filter(a => a.id !== id))
    toast.success('Campaign deleted')
  }

  function toggleStr(field: string, subfield: string, val: string) {
    const arr = (segForm.conditions as any)[subfield] as string[]
    setSegForm(f => ({ ...f, conditions: { ...f.conditions, [subfield]: arr.includes(val) ? arr.filter((x: string) => x !== val) : [...arr, val] } }))
  }

  function toggleSegmentOnAd(segId: string) {
    setAdForm(f => ({ ...f, segment_ids: f.segment_ids.includes(segId) ? f.segment_ids.filter(x => x !== segId) : [...f.segment_ids, segId] }))
  }

  const ctr = (ad: DirectAd) => ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '0.0'
  const earned = (ad: DirectAd) => ad.cpm_rate_inr > 0 ? Math.round((ad.impressions / 1000) * ad.cpm_rate_inr) : 0
  const filteredAds = statusFilter === 'all' ? ads : ads.filter(a => getCampaignStatus(a) === statusFilter)
  const counts = { all: ads.length, active: ads.filter(a => getCampaignStatus(a) === 'active').length, scheduled: ads.filter(a => getCampaignStatus(a) === 'scheduled').length, paused: ads.filter(a => getCampaignStatus(a) === 'paused').length, ended: ads.filter(a => getCampaignStatus(a) === 'ended').length }

  const selectedSlot = adSlots.find(s => s.id === adForm.ad_slot_id)

  if (loading) return <div className="h-24 bg-ink-50 rounded-xl animate-pulse" />

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 p-1 bg-ink-100 rounded-xl">
          {[{ key: 'campaigns', label: `🎯 Campaigns (${ads.length})` }, { key: 'segments', label: `👥 Segments (${segments.length})` }].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as 'campaigns' | 'segments')}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${activeTab === t.key ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={() => activeTab === 'campaigns' ? setShowAdForm(true) : setShowSegForm(true)} className="btn-primary text-xs px-4 py-2">
          + {activeTab === 'campaigns' ? 'New Campaign' : 'New Segment'}
        </button>
      </div>

      {/* ── CAMPAIGNS TAB ── */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">

          {/* Campaign form */}
          {showAdForm && (
            <div className="card p-5 space-y-5 border-2 border-accent/20">
              <h3 className="font-semibold text-ink-900">New Ad Campaign</h3>

              {/* Campaign details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Campaign Name *</label>
                  <input className="input" value={adForm.campaign_name}
                    onChange={e => setAdForm(f => ({ ...f, campaign_name: e.target.value }))}
                    placeholder="e.g. Diwali Sale — Bengaluru Mobile" />
                </div>
              </div>

              {/* Ad source — existing unit or new creative */}
              <div>
                <label className="label">Ad Source</label>
                <div className="flex gap-3 mt-1">
                  {[
                    { key: 'existing', label: '🔌 Use existing ad unit', sub: 'From Monetization tab' },
                    { key: 'banner',   label: '🖼 Banner (image)',       sub: 'Upload new image URL' },
                    { key: 'text',     label: '📝 Text ad',              sub: 'Headline + description' },
                    { key: 'native',   label: '📰 Native',               sub: 'Image + text combo' },
                  ].map(opt => (
                    <button key={opt.key} onClick={() => setAdForm(f => ({ ...f, ad_type: opt.key }))}
                      className={`flex-1 p-3 rounded-xl border text-left text-xs transition-colors ${adForm.ad_type === opt.key ? 'border-accent bg-accent/5' : 'border-ink-200 hover:border-ink-300'}`}>
                      <p className="font-semibold text-ink-900">{opt.label}</p>
                      <p className="text-ink-400 mt-0.5">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Existing ad unit selector */}
              {adForm.ad_type === 'existing' && (
                <div>
                  <label className="label">Select Ad Unit *</label>
                  {adSlots.length === 0 ? (
                    <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">No ad units found — create ad units in Monetization → Ad Units first</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {adSlots.map(slot => (
                        <button key={slot.id} onClick={() => setAdForm(f => ({ ...f, ad_slot_id: slot.id, position: slot.position }))}
                          className={`text-left p-3 rounded-xl border text-xs transition-colors ${adForm.ad_slot_id === slot.id ? 'border-accent bg-accent/5' : 'border-ink-200 hover:border-ink-300'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-ink-900">{slot.name}</p>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${slot.is_enabled ? 'bg-green-100 text-green-700' : 'bg-ink-100 text-ink-500'}`}>
                              {slot.is_enabled ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <p className="text-ink-400 capitalize">{slot.position?.replace('_', ' ')} · {slot.ad_type?.toUpperCase()}</p>
                          {(slot.size_width && slot.size_height) ? <p className="text-ink-300">{slot.size_width}×{slot.size_height}</p> : null}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedSlot && (
                    <div className="mt-3 p-3 bg-ink-50 rounded-lg">
                      <p className="text-xs font-medium text-ink-700 mb-1">Selected: {selectedSlot.name}</p>
                      <p className="text-xs text-ink-400">The existing ad code from this unit will be served to matched visitors</p>
                      <div>
                        <label className="label mt-2">Destination URL (for click tracking) *</label>
                        <input className="input" value={adForm.destination_url}
                          onChange={e => setAdForm(f => ({ ...f, destination_url: e.target.value }))}
                          placeholder="https://advertiser.com/landing" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* New creative fields */}
              {adForm.ad_type !== 'existing' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Headline</label>
                    <input className="input" value={adForm.headline}
                      onChange={e => setAdForm(f => ({ ...f, headline: e.target.value }))} placeholder="Ad headline" />
                  </div>
                  <div>
                    <label className="label">CTA Text</label>
                    <input className="input" value={adForm.cta_text}
                      onChange={e => setAdForm(f => ({ ...f, cta_text: e.target.value }))} placeholder="Learn More" />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Description</label>
                    <textarea className="input resize-none" rows={2} value={adForm.description}
                      onChange={e => setAdForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  {(adForm.ad_type === 'banner' || adForm.ad_type === 'native') && (
                    <div className="col-span-2">
                      <label className="label">Image URL</label>
                      <input className="input" value={adForm.image_url}
                        onChange={e => setAdForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://example.com/banner.jpg" />
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="label">Destination URL *</label>
                    <input className="input" value={adForm.destination_url}
                      onChange={e => setAdForm(f => ({ ...f, destination_url: e.target.value }))} placeholder="https://advertiser.com" />
                  </div>
                  <div>
                    <label className="label">Position</label>
                    <select className="input" value={adForm.position} onChange={e => setAdForm(f => ({ ...f, position: e.target.value }))}>
                      <option value="header">Header</option>
                      <option value="in_content">In Content</option>
                      <option value="footer">Footer</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Campaign schedule + budget */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="label">Start Date</label>
                  <input type="date" className="input" value={adForm.start_date}
                    onChange={e => setAdForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input type="date" className="input" value={adForm.end_date}
                    onChange={e => setAdForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
                <div>
                  <label className="label">CPM Rate (₹)</label>
                  <input type="number" className="input" min={0} step="0.01" value={adForm.cpm_rate_inr}
                    onChange={e => setAdForm(f => ({ ...f, cpm_rate_inr: parseFloat(e.target.value) || 0 }))}
                    placeholder="e.g. 50" />
                  <p className="text-xs text-ink-400 mt-1">Per 1000 impr.</p>
                </div>
                <div>
                  <label className="label">Impr. Cap</label>
                  <input type="number" className="input" min={0} value={adForm.impressions_cap}
                    onChange={e => setAdForm(f => ({ ...f, impressions_cap: parseInt(e.target.value) || 0 }))}
                    placeholder="0 = unlimited" />
                </div>
              </div>

              {/* Priority */}
              <div className="w-48">
                <label className="label">Priority (0–100)</label>
                <input type="number" className="input" min={0} max={100} value={adForm.priority}
                  onChange={e => setAdForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} />
                <p className="text-xs text-ink-400 mt-1">Higher = replaces lower priority campaigns</p>
              </div>

              {/* Audience targeting */}
              <div>
                <label className="label">Audience Targeting</label>
                <div className="flex items-center gap-3 mb-3">
                  <input type="checkbox" id="target_all" checked={adForm.target_all}
                    onChange={e => setAdForm(f => ({ ...f, target_all: e.target.checked }))} className="w-4 h-4 accent-accent" />
                  <label htmlFor="target_all" className="text-sm text-ink-700">Show to all visitors — no targeting (run on all publisher sites)</label>
                </div>
                {!adForm.target_all && (
                  <div>
                    {segments.length > 0 ? (
                      <>
                        <p className="text-xs text-ink-400 mb-2">Select audience segments to target:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {segments.map(seg => (
                            <button key={seg.id} onClick={() => toggleSegmentOnAd(seg.id)}
                              className={`text-left p-3 rounded-xl border text-xs transition-colors ${adForm.segment_ids.includes(seg.id) ? 'border-accent bg-accent/5' : 'border-ink-100 hover:border-ink-200'}`}>
                              <p className="font-medium text-ink-900">{seg.name}</p>
                              <p className="text-ink-400">{seg.profile_count} matching readers</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {seg.conditions.countries?.map(c => <span key={c} className="bg-blue-50 text-blue-600 px-1 rounded text-[10px]">🌍 {c}</span>)}
                                {seg.conditions.states?.map(s => <span key={s} className="bg-violet-50 text-violet-600 px-1 rounded text-[10px]">🗺 {s}</span>)}
                                {seg.conditions.cities?.map(c => <span key={c} className="bg-green-50 text-green-600 px-1 rounded text-[10px]">📍 {c}</span>)}
                                {seg.conditions.devices?.map(d => <span key={d} className="bg-amber-50 text-amber-600 px-1 rounded text-[10px] capitalize">📱 {d}</span>)}
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">Create audience segments first to target specific readers</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="label">Campaign Notes</label>
                <textarea className="input resize-none" rows={2} value={adForm.campaign_notes}
                  onChange={e => setAdForm(f => ({ ...f, campaign_notes: e.target.value }))}
                  placeholder="Advertiser name, deal details, contact" />
              </div>

              <div className="flex gap-3">
                <button onClick={saveAd} className="btn-primary">Launch Campaign</button>
                <button onClick={() => { setShowAdForm(false); setAdForm({ ...EMPTY_AD }) }}
                  className="px-4 py-2 text-sm bg-ink-100 text-ink-600 rounded-xl">Cancel</button>
              </div>
            </div>
          )}

          {/* Status filters */}
          {ads.length > 0 && (
            <div className="flex gap-1 p-1 bg-ink-100 rounded-xl w-fit flex-wrap">
              {[
                { key: 'all',       label: `All (${counts.all})` },
                { key: 'active',    label: `🟢 Active (${counts.active})` },
                { key: 'scheduled', label: `🔵 Scheduled (${counts.scheduled})` },
                { key: 'paused',    label: `🟡 Paused (${counts.paused})` },
                { key: 'ended',     label: `⚫ Ended (${counts.ended})` },
              ].map(t => (
                <button key={t.key} onClick={() => setStatusFilter(t.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === t.key ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Campaigns table */}
          {filteredAds.length === 0 && !showAdForm ? (
            <div className="card p-8 text-center">
              <p className="text-2xl mb-2">🎯</p>
              <p className="text-sm text-ink-500 mb-1">No campaigns yet</p>
              <p className="text-xs text-ink-400">Network ads (Adsterra etc.) run by default. Direct campaigns replace them when active.</p>
            </div>
          ) : filteredAds.length > 0 && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-ink-50 border-b border-ink-100">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-ink-500">Campaign</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Status</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Ad Unit</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Schedule</th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-ink-500">Impr.</th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-ink-500">Clicks</th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-ink-500">CTR</th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-ink-500">Earned</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Actions</th>
                </tr></thead>
                <tbody>
                  {filteredAds.map(ad => {
                    const status = getCampaignStatus(ad)
                    const slot = adSlots.find(s => s.id === ad.ad_slot_id)
                    return (
                      <tr key={ad.id} className={`border-b border-ink-50 hover:bg-ink-50/50 ${status === 'ended' ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="text-xs font-semibold text-ink-900">{ad.campaign_name || ad.name}</p>
                          <p className="text-xs text-ink-400">{ad.target_all ? 'All visitors' : `${ad.segment_ids?.length || 0} segments`} · P{ad.priority}</p>
                          {ad.campaign_notes && <p className="text-xs text-ink-300 truncate max-w-xs">{ad.campaign_notes}</p>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[status]}`}>{status}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-xs bg-ink-100 text-ink-600 px-2 py-0.5 rounded-full">
                            {slot ? slot.name : ad.position?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-ink-500">
                          {ad.start_date || '—'}<br />{ad.end_date ? `→ ${ad.end_date}` : '∞'}
                        </td>
                        <td className="px-3 py-3 text-right text-xs text-ink-600">{(ad.impressions || 0).toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-xs text-ink-600">{(ad.clicks || 0).toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-xs font-medium text-green-600">{ctr(ad)}%</td>
                        <td className="px-3 py-3 text-right text-xs font-medium text-amber-600">
                          {ad.cpm_rate_inr > 0 ? `₹${earned(ad).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => toggleAd(ad.id, ad.is_active)}
                              className={`text-xs px-2 py-1 rounded-lg ${ad.is_active ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                              {ad.is_active ? '⏸' : '▶'}
                            </button>
                            <button onClick={() => deleteAd(ad.id)}
                              className="text-xs px-2 py-1 rounded-lg text-red-500 hover:bg-red-50">🗑</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Info box */}
          <div className="card p-4 bg-blue-50/50 border border-blue-100">
            <p className="text-xs font-semibold text-blue-800 mb-2">💡 How campaigns work</p>
            <div className="grid sm:grid-cols-3 gap-3 text-xs text-blue-700">
              <div><span className="font-medium">Default:</span> Network ads (Adsterra etc.) run on all publisher sites automatically</div>
              <div><span className="font-medium">Campaign active:</span> Direct ad replaces network ad for matched visitors during the campaign period</div>
              <div><span className="font-medium">Campaign ends:</span> Network ads resume automatically — no action needed</div>
            </div>
          </div>
        </div>
      )}

      {/* ── SEGMENTS TAB ── */}
      {activeTab === 'segments' && (
        <div className="space-y-4">
          {showSegForm && (
            <div className="card p-5 space-y-4 border-2 border-accent/20">
              <h3 className="font-semibold text-ink-900">New Audience Segment</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Segment Name *</label>
                  <input className="input" value={segForm.name}
                    onChange={e => setSegForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Karnataka Mobile Readers" />
                </div>
                <div>
                  <label className="label">Description</label>
                  <input className="input" value={segForm.description}
                    onChange={e => setSegForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
                </div>
              </div>

              {/* Country */}
              <div>
                <label className="label">🌍 Target Countries</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {COUNTRIES.map(c => (
                    <button key={c} onClick={() => toggleStr('conditions', 'countries', c)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${segForm.conditions.countries?.includes(c) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-ink-600 border-ink-200 hover:border-blue-400'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* State — show only if India selected or no country filter */}
              {(segForm.conditions.countries?.includes('India') || !segForm.conditions.countries?.length) && (
                <div>
                  <label className="label">🗺 Target States (India)</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {INDIAN_STATES.map(s => (
                      <button key={s} onClick={() => toggleStr('conditions', 'states', s)}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${segForm.conditions.states?.includes(s) ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-ink-600 border-ink-200 hover:border-violet-400'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* City */}
              <div>
                <label className="label">📍 Target Cities</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {CITIES.map(c => (
                    <button key={c} onClick={() => toggleStr('conditions', 'cities', c)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${segForm.conditions.cities?.includes(c) ? 'bg-green-600 text-white border-green-600' : 'bg-white text-ink-600 border-ink-200 hover:border-green-400'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Device */}
              <div>
                <label className="label">📱 Target Devices</label>
                <div className="flex gap-2 mt-1">
                  {DEVICES.map(d => (
                    <button key={d} onClick={() => toggleStr('conditions', 'devices', d)}
                      className={`text-xs px-3 py-1.5 rounded-lg border capitalize transition-colors ${segForm.conditions.devices?.includes(d) ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-ink-600 border-ink-200 hover:border-amber-400'}`}>
                      {d === 'mobile' ? '📱' : d === 'desktop' ? '💻' : '📟'} {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interests */}
              <div>
                <label className="label">🏷 Target Interests</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {INTERESTS.map(i => (
                    <button key={i} onClick={() => toggleStr('conditions', 'interests', i)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${segForm.conditions.interests?.includes(i) ? 'bg-red-500 text-white border-red-500' : 'bg-white text-ink-600 border-ink-200 hover:border-red-400'}`}>
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              {/* Min page views */}
              <div className="w-48">
                <label className="label">Min. Page Views</label>
                <input type="number" className="input" min={0} value={segForm.conditions.min_page_views}
                  onChange={e => setSegForm(f => ({ ...f, conditions: { ...f.conditions, min_page_views: parseInt(e.target.value) || 0 } }))} />
                <p className="text-xs text-ink-400 mt-1">Only target engaged readers</p>
              </div>

              <div className="flex gap-3">
                <button onClick={saveSeg} className="btn-primary">Save Segment</button>
                <button onClick={() => { setShowSegForm(false); setSegForm({ ...EMPTY_SEG }) }}
                  className="px-4 py-2 text-sm bg-ink-100 text-ink-600 rounded-xl">Cancel</button>
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
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{seg.profile_count} readers</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {seg.conditions.countries?.map(c => <span key={c} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">🌍 {c}</span>)}
                    {seg.conditions.states?.map(s => <span key={s} className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">🗺 {s}</span>)}
                    {seg.conditions.cities?.map(c => <span key={c} className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">📍 {c}</span>)}
                    {seg.conditions.devices?.map(d => <span key={d} className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full capitalize">📱 {d}</span>)}
                    {seg.conditions.interests?.map(i => <span key={i} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">🏷 {i}</span>)}
                    {seg.conditions.min_page_views ? <span className="text-xs bg-ink-100 text-ink-600 px-2 py-0.5 rounded-full">⏱ {seg.conditions.min_page_views}+ views</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
