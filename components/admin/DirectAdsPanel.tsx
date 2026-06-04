'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface AdUnit {
  id: string; name: string; position: string
  size_width: number; size_height: number
  is_active: boolean; network_name: string; site_url: string
  ad_code: string
}

interface Segment {
  id: string; name: string
  conditions: { countries?: string[]; states?: string[]; cities?: string[]; devices?: string[]; interests?: string[]; min_page_views?: number }
  profile_count: number
}

interface DirectAd {
  id: string; campaign_name: string; campaign_notes: string
  ad_type: string; headline: string; description: string
  image_url: string; cta_text: string; destination_url: string
  target_ad_unit_ids: string[]; segment_ids: string[]; target_all: boolean
  priority: number; cpm_rate_inr: number; impressions_cap: number
  start_date: string; end_date: string
  impressions: number; clicks: number; is_active: boolean
}

interface UnitPerf {
  ad_unit_id: string; network_name: string; date: string
  impressions: number; clicks: number; revenue_usd: number; cpm_usd: number; ctr: number
}

const POSITION_LABELS: Record<string, string> = {
  header: '🔼 Header', in_content: '📍 In-Content', footer: '🔽 Footer', sidebar: '◧ Sidebar'
}
const NETWORK_COLORS: Record<string, string> = {
  adsterra: 'bg-blue-100 text-blue-700', adsense: 'bg-green-100 text-green-700',
  medianet: 'bg-amber-100 text-amber-700', direct: 'bg-violet-100 text-violet-700', other: 'bg-ink-100 text-ink-600',
}
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700', scheduled: 'bg-blue-100 text-blue-700',
  ended: 'bg-ink-100 text-ink-500', paused: 'bg-amber-100 text-amber-700',
}

const COUNTRIES = ['India', 'United States', 'United Kingdom', 'UAE', 'Canada', 'Australia']
const INDIAN_STATES = ['Karnataka', 'Tamil Nadu', 'Andhra Pradesh', 'Telangana', 'Kerala', 'Maharashtra', 'Gujarat', 'West Bengal', 'Punjab', 'Rajasthan', 'Uttar Pradesh', 'Bihar', 'Delhi', 'Haryana', 'Madhya Pradesh', 'Odisha', 'Goa']
const CITIES = ['Bengaluru', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad', 'Mangaluru', 'Mysuru', 'Gurugram', 'Noida', 'Surat', 'Jaipur', 'Kochi', 'Coimbatore']
const DEVICES = ['mobile', 'desktop', 'tablet']
const INTERESTS = ['Karnataka', 'Politics', 'Entertainment', 'Sports', 'Technology', 'Business', 'Health', 'Education', 'Astro', 'Crime', 'Local News']
const NETWORKS = ['adsterra', 'adsense', 'medianet', 'taboola', 'mgid', 'direct', 'other']

function getStatus(ad: DirectAd) {
  if (!ad.is_active) return 'paused'
  const today = new Date().toISOString().split('T')[0]
  if (ad.start_date && ad.start_date > today) return 'scheduled'
  if (ad.end_date && ad.end_date < today) return 'ended'
  return 'active'
}

const EMPTY_AD = {
  campaign_name: '', campaign_notes: '', ad_type: 'script',
  headline: '', description: '', image_url: '', cta_text: 'Learn More',
  destination_url: '', ad_code_override: '',
  target_ad_unit_ids: [] as string[], segment_ids: [] as string[], target_all: false,
  priority: 0, cpm_rate_inr: 0, impressions_cap: 0, start_date: '', end_date: '',
}

const EMPTY_SEG = {
  name: '', description: '',
  conditions: { countries: [] as string[], states: [] as string[], cities: [] as string[], devices: [] as string[], interests: [] as string[], min_page_views: 0 },
}

export function DirectAdsPanel() {
  const [adUnits, setAdUnits] = useState<AdUnit[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [ads, setAds] = useState<DirectAd[]>([])
  const [performance, setPerformance] = useState<UnitPerf[]>([])
  const [activeTab, setActiveTab] = useState<'campaigns' | 'performance' | 'segments'>('campaigns')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAdForm, setShowAdForm] = useState(false)
  const [showSegForm, setShowSegForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [adForm, setAdForm] = useState<any>({ ...EMPTY_AD })
  const [segForm, setSegForm] = useState({ ...EMPTY_SEG })
  const [perfDays, setPerfDays] = useState(7)

  useEffect(() => { fetchAll() }, [])
  useEffect(() => { if (activeTab === 'performance') fetchPerformance() }, [activeTab, perfDays])

  async function fetchAll() {
    setLoading(true)
    const [unitsRes, segsRes, adsRes] = await Promise.all([
      fetch('/api/adunits'),
      fetch('/api/audience/segments'),
      fetch('/api/audience/direct-ads'),
    ])
    if (unitsRes.ok) setAdUnits(await unitsRes.json())
    if (segsRes.ok) setSegments(await segsRes.json())
    if (adsRes.ok) setAds(await adsRes.json())
    setLoading(false)
  }

  async function fetchPerformance() {
    const res = await fetch(`/api/audience/ad-performance?days=${perfDays}`)
    if (res.ok) setPerformance(await res.json())
  }

  function toggleUnit(id: string) {
    setAdForm((f: any) => ({
      ...f,
      target_ad_unit_ids: f.target_ad_unit_ids.includes(id)
        ? f.target_ad_unit_ids.filter((x: string) => x !== id)
        : [...f.target_ad_unit_ids, id],
    }))
  }

  function toggleSeg(id: string) {
    setAdForm((f: any) => ({ ...f, segment_ids: f.segment_ids.includes(id) ? f.segment_ids.filter((x: string) => x !== id) : [...f.segment_ids, id] }))
  }

  function toggleCond(field: string, val: string) {
    const arr = (segForm.conditions as any)[field] as string[]
    setSegForm(f => ({ ...f, conditions: { ...f.conditions, [field]: arr.includes(val) ? arr.filter((x: string) => x !== val) : [...arr, val] } }))
  }

  async function saveAd() {
    if (!adForm.campaign_name) { toast.error('Campaign name required'); return }
    if (!adForm.target_all && adForm.target_ad_unit_ids.length === 0) { toast.error('Select at least one ad unit'); return }
    const res = await fetch('/api/audience/direct-ads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...adForm, name: adForm.campaign_name }),
    })
    if (res.ok) { toast.success('Campaign launched!'); setShowAdForm(false); setAdForm({ ...EMPTY_AD }); fetchAll() }
    else toast.error('Failed to launch campaign')
  }

  async function saveSeg() {
    if (!segForm.name) { toast.error('Name required'); return }
    const res = await fetch('/api/audience/segments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(segForm),
    })
    if (res.ok) { toast.success('Segment saved!'); setShowSegForm(false); setSegForm({ ...EMPTY_SEG }); fetchAll() }
    else toast.error('Failed')
  }

  async function toggleAd(id: string, current: boolean) {
    await fetch('/api/audience/direct-ads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_active: !current }) })
    setAds(prev => prev.map(a => a.id === id ? { ...a, is_active: !current } : a))
    toast.success(!current ? 'Activated' : 'Paused')
  }

  async function deleteAd(id: string) {
    if (!confirm('Delete this campaign?')) return
    await fetch(`/api/audience/direct-ads?id=${id}`, { method: 'DELETE' })
    setAds(prev => prev.filter(a => a.id !== id))
    toast.success('Deleted')
  }

  async function updateUnitNetwork(unitId: string, network: string) {
    await fetch('/api/adunits', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: unitId, network_name: network }) })
    setAdUnits(prev => prev.map(u => u.id === unitId ? { ...u, network_name: network } : u))
    toast.success('Network updated')
  }

  // Group ad units by position
  const groupedUnits = adUnits.reduce((acc, unit) => {
    const pos = unit.position || 'other'
    if (!acc[pos]) acc[pos] = []
    acc[pos].push(unit)
    return acc
  }, {} as Record<string, AdUnit[]>)

  // Performance analysis
  const perfByUnit = performance.reduce((acc, p) => {
    if (!acc[p.ad_unit_id]) acc[p.ad_unit_id] = { impressions: 0, clicks: 0, revenue: 0 }
    acc[p.ad_unit_id].impressions += p.impressions
    acc[p.ad_unit_id].clicks += p.clicks
    acc[p.ad_unit_id].revenue += p.revenue_usd
    return acc
  }, {} as Record<string, { impressions: number; clicks: number; revenue: number }>)

  const filteredAds = statusFilter === 'all' ? ads : ads.filter(a => getStatus(a) === statusFilter)
  const counts = { all: ads.length, active: ads.filter(a => getStatus(a) === 'active').length, scheduled: ads.filter(a => getStatus(a) === 'scheduled').length, paused: ads.filter(a => getStatus(a) === 'paused').length, ended: ads.filter(a => getStatus(a) === 'ended').length }

  if (loading) return <div className="h-24 bg-ink-50 rounded-xl animate-pulse" />

  return (
    <div className="space-y-5">

      {/* Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 p-1 bg-ink-100 rounded-xl">
          {[
            { key: 'campaigns', label: `🎯 Campaigns (${ads.length})` },
            { key: 'performance', label: '📊 Performance' },
            { key: 'segments', label: `👥 Segments (${segments.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as any)}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${activeTab === t.key ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
              {t.label}
            </button>
          ))}
        </div>
        {activeTab === 'campaigns' && (
          <button onClick={() => setShowAdForm(true)} className="btn-primary text-xs px-4 py-2">+ New Campaign</button>
        )}
        {activeTab === 'segments' && (
          <button onClick={() => setShowSegForm(true)} className="btn-primary text-xs px-4 py-2">+ New Segment</button>
        )}
      </div>

      {/* ── CAMPAIGNS ── */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">

          {showAdForm && (
            <div className="card p-5 space-y-6 border-2 border-accent/20">
              <h3 className="font-semibold text-ink-900">🎯 New Ad Campaign</h3>

              <div>
                <label className="label">Campaign Name *</label>
                <input className="input" value={adForm.campaign_name}
                  onChange={e => setAdForm((f: any) => ({ ...f, campaign_name: e.target.value }))}
                  placeholder="e.g. Diwali Sale — Kannadadunia In-Content" />
              </div>

              {/* STEP 1 — Select Ad Units */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                  <p className="text-sm font-semibold text-ink-900">Select Ad Units to run this campaign on</p>
                </div>
                <p className="text-xs text-ink-400 mb-3">These are the ad positions created in Monetization. Select one or more — your direct campaign will replace the current network ad in those slots.</p>

                <div className="flex items-center gap-3 mb-4">
                  <input type="checkbox" checked={adForm.target_all} onChange={e => setAdForm((f: any) => ({ ...f, target_all: e.target.checked, target_ad_unit_ids: [] }))} className="w-4 h-4 accent-accent" />
                  <label className="text-sm text-ink-700">Run on <strong>all ad units</strong> across all publisher sites</label>
                </div>

                {!adForm.target_all && (
                  <div className="space-y-4">
                    {Object.entries(groupedUnits).map(([position, units]) => (
                      <div key={position}>
                        <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">{POSITION_LABELS[position] || position}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {units.map(unit => {
                            const selected = adForm.target_ad_unit_ids.includes(unit.id)
                            return (
                              <button key={unit.id} onClick={() => toggleUnit(unit.id)}
                                className={`text-left p-3 rounded-xl border transition-all ${selected ? 'border-accent bg-accent/5 shadow-sm' : 'border-ink-200 hover:border-ink-300'}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-semibold text-ink-900 leading-tight">{unit.name}</p>
                                  {selected && <span className="text-accent shrink-0">✓</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${NETWORK_COLORS[unit.network_name] || NETWORK_COLORS.other}`}>
                                    {unit.network_name || 'unknown'}
                                  </span>
                                  <span className="text-[10px] text-ink-400">{unit.size_width}×{unit.size_height}</span>
                                  {unit.site_url && <span className="text-[10px] text-ink-400 truncate max-w-[100px]">{unit.site_url.replace(/https?:\/\//, '')}</span>}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    {adForm.target_ad_unit_ids.length > 0 && (
                      <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                        ✓ {adForm.target_ad_unit_ids.length} unit{adForm.target_ad_unit_ids.length > 1 ? 's' : ''} selected
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* STEP 2 — Ad Script or Creative */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                  <p className="text-sm font-semibold text-ink-900">Ad Creative</p>
                </div>

                <div className="flex gap-2 mb-3">
                  {[
                    { k: 'script', l: '📜 Ad Script', sub: 'Paste advertiser JS/HTML code' },
                    { k: 'banner', l: '🖼 Banner', sub: 'Image URL + click destination' },
                    { k: 'text', l: '📝 Text Ad', sub: 'Headline + description' },
                    { k: 'native', l: '📰 Native', sub: 'Image + text combo' },
                  ].map(opt => (
                    <button key={opt.k} onClick={() => setAdForm((f: any) => ({ ...f, ad_type: opt.k }))}
                      className={`flex-1 p-2.5 rounded-xl border text-xs text-left transition-colors ${adForm.ad_type === opt.k ? 'border-accent bg-accent/5' : 'border-ink-200 hover:border-ink-300'}`}>
                      <p className="font-semibold text-ink-900">{opt.l}</p>
                      <p className="text-ink-400 mt-0.5">{opt.sub}</p>
                    </button>
                  ))}
                </div>

                {adForm.ad_type === 'script' && (
                  <div>
                    <label className="label">Ad Script (HTML/JS from advertiser) *</label>
                    <textarea className="input font-mono text-xs resize-none" rows={6}
                      value={adForm.ad_code_override || ''}
                      onChange={e => setAdForm((f: any) => ({ ...f, ad_code_override: e.target.value }))}
                      placeholder={'<script>\n  // Paste your advertiser script here\n  // e.g. Adsterra, MediaNet, Taboola etc.\n</script>'} />
                    <p className="text-xs text-ink-400 mt-1">This script will run in the selected ad unit slots instead of the current network ad</p>
                  </div>
                )}

                {adForm.ad_type !== 'script' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Headline</label>
                      <input className="input" value={adForm.headline} onChange={e => setAdForm((f: any) => ({ ...f, headline: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">CTA Text</label>
                      <input className="input" value={adForm.cta_text} onChange={e => setAdForm((f: any) => ({ ...f, cta_text: e.target.value }))} />
                    </div>
                    {adForm.ad_type !== 'text' && (
                      <div className="col-span-2">
                        <label className="label">Image URL</label>
                        <input className="input" value={adForm.image_url} onChange={e => setAdForm((f: any) => ({ ...f, image_url: e.target.value }))} placeholder="https://example.com/banner.jpg" />
                      </div>
                    )}
                    <div className="col-span-2">
                      <label className="label">Description</label>
                      <input className="input" value={adForm.description} onChange={e => setAdForm((f: any) => ({ ...f, description: e.target.value }))} />
                    </div>
                    <div className="col-span-2">
                      <label className="label">Destination URL *</label>
                      <input className="input" value={adForm.destination_url} onChange={e => setAdForm((f: any) => ({ ...f, destination_url: e.target.value }))} placeholder="https://advertiser.com" />
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 3 — Audience */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                  <p className="text-sm font-semibold text-ink-900">Audience Targeting <span className="text-ink-400 font-normal text-xs">(optional)</span></p>
                </div>
                {segments.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {segments.map(seg => (
                      <button key={seg.id} onClick={() => toggleSeg(seg.id)}
                        className={`text-left p-3 rounded-xl border text-xs transition-colors ${adForm.segment_ids.includes(seg.id) ? 'border-accent bg-accent/5' : 'border-ink-100 hover:border-ink-200'}`}>
                        <p className="font-medium text-ink-900">{seg.name}</p>
                        <p className="text-ink-400">{seg.profile_count} matching readers</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-ink-400 bg-ink-50 p-3 rounded-lg">No segments yet — campaign will run for all visitors on selected units</p>
                )}
              </div>

              {/* STEP 4 — Schedule */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">4</span>
                  <p className="text-sm font-semibold text-ink-900">Schedule & Pricing</p>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="label">Start Date</label>
                    <input type="date" className="input" value={adForm.start_date} onChange={e => setAdForm((f: any) => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">End Date</label>
                    <input type="date" className="input" value={adForm.end_date} onChange={e => setAdForm((f: any) => ({ ...f, end_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">CPM Rate (₹)</label>
                    <input type="number" className="input" min={0} step="0.01" value={adForm.cpm_rate_inr}
                      onChange={e => setAdForm((f: any) => ({ ...f, cpm_rate_inr: parseFloat(e.target.value) || 0 }))} placeholder="0" />
                  </div>
                  <div>
                    <label className="label">Impr. Cap</label>
                    <input type="number" className="input" min={0} value={adForm.impressions_cap}
                      onChange={e => setAdForm((f: any) => ({ ...f, impressions_cap: parseInt(e.target.value) || 0 }))} placeholder="0 = ∞" />
                  </div>
                </div>
                <div className="mt-3 w-32">
                  <label className="label">Priority (0–100)</label>
                  <input type="number" className="input" min={0} max={100} value={adForm.priority}
                    onChange={e => setAdForm((f: any) => ({ ...f, priority: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>

              <div>
                <label className="label">Campaign Notes</label>
                <textarea className="input resize-none" rows={2} value={adForm.campaign_notes}
                  onChange={e => setAdForm((f: any) => ({ ...f, campaign_notes: e.target.value }))}
                  placeholder="Advertiser name, deal value, contact info" />
              </div>

              <div className="flex gap-3">
                <button onClick={saveAd} className="btn-primary">🚀 Launch Campaign</button>
                <button onClick={() => { setShowAdForm(false); setAdForm({ ...EMPTY_AD }) }} className="px-4 py-2 text-sm bg-ink-100 text-ink-600 rounded-xl">Cancel</button>
              </div>
            </div>
          )}

          {/* Status filter */}
          {ads.length > 0 && (
            <div className="flex gap-1 p-1 bg-ink-100 rounded-xl w-fit flex-wrap">
              {[{ k: 'all', l: `All (${counts.all})` }, { k: 'active', l: `🟢 ${counts.active}` }, { k: 'scheduled', l: `🔵 ${counts.scheduled}` }, { k: 'paused', l: `🟡 ${counts.paused}` }, { k: 'ended', l: `⚫ ${counts.ended}` }].map(t => (
                <button key={t.k} onClick={() => setStatusFilter(t.k)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === t.k ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
                  {t.l}
                </button>
              ))}
            </div>
          )}

          {filteredAds.length === 0 && !showAdForm ? (
            <div className="card p-8 text-center">
              <p className="text-2xl mb-2">🎯</p>
              <p className="text-sm text-ink-500 mb-1">No campaigns yet</p>
              <p className="text-xs text-ink-400">Network ads run by default. Direct campaigns replace them on selected units when active.</p>
            </div>
          ) : filteredAds.length > 0 && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-ink-50 border-b border-ink-100">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-ink-500">Campaign</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Status</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Units</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Schedule</th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-ink-500">Impr.</th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-ink-500">CTR</th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-ink-500">Earned</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Actions</th>
                </tr></thead>
                <tbody>
                  {filteredAds.map(ad => {
                    const status = getStatus(ad)
                    const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '0.0'
                    const earned = ad.cpm_rate_inr > 0 ? Math.round((ad.impressions / 1000) * ad.cpm_rate_inr) : 0
                    const unitNames = (ad.target_ad_unit_ids || []).map(id => adUnits.find(u => u.id === id)?.name).filter(Boolean).join(', ')
                    return (
                      <tr key={ad.id} className={`border-b border-ink-50 hover:bg-ink-50/50 ${status === 'ended' ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="text-xs font-semibold text-ink-900">{ad.campaign_name}</p>
                          <p className="text-xs text-ink-400 truncate">{unitNames || (ad.target_all ? 'All units' : '—')}</p>
                          {ad.campaign_notes && <p className="text-xs text-ink-300 truncate">{ad.campaign_notes}</p>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[status]}`}>{status}</span>
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-ink-600">{ad.target_all ? 'All' : (ad.target_ad_unit_ids?.length || 0)}</td>
                        <td className="px-3 py-3 text-center text-xs text-ink-500">{ad.start_date || '—'}{ad.end_date ? ` → ${ad.end_date}` : ' → ∞'}</td>
                        <td className="px-3 py-3 text-right text-xs">{(ad.impressions || 0).toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-xs font-medium text-green-600">{ctr}%</td>
                        <td className="px-3 py-3 text-right text-xs font-medium text-amber-600">{ad.cpm_rate_inr > 0 ? `₹${earned.toLocaleString()}` : '—'}</td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => toggleAd(ad.id, ad.is_active)}
                              className={`text-xs px-2 py-1 rounded-lg ${ad.is_active ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                              {ad.is_active ? '⏸' : '▶'}
                            </button>
                            <button onClick={() => deleteAd(ad.id)} className="text-xs px-2 py-1 rounded-lg text-red-500 hover:bg-red-50">🗑</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="card p-4 bg-blue-50/50 border border-blue-100">
            <p className="text-xs font-semibold text-blue-800 mb-1">💡 How it works</p>
            <div className="grid sm:grid-cols-3 gap-3 text-xs text-blue-700">
              <div><span className="font-medium">Default:</span> Each ad unit runs its assigned network ad (Adsterra, AdSense etc.)</div>
              <div><span className="font-medium">Campaign active:</span> Your direct ad script replaces network ad in selected units for matched visitors</div>
              <div><span className="font-medium">Campaign ends:</span> Network ads resume automatically — no action needed</div>
            </div>
          </div>
        </div>
      )}

      {/* ── PERFORMANCE ── */}
      {activeTab === 'performance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-ink-900">Network Ad Performance by Unit</h3>
            <div className="flex gap-1 p-1 bg-ink-100 rounded-xl">
              {[7, 14, 30].map(d => (
                <button key={d} onClick={() => setPerfDays(d)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${perfDays === d ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* Ad units with network labels + performance */}
          <div className="space-y-3">
            {Object.entries(groupedUnits).map(([position, units]) => (
              <div key={position} className="card overflow-hidden">
                <div className="px-4 py-2.5 bg-ink-50 border-b border-ink-100">
                  <p className="text-xs font-semibold text-ink-700">{POSITION_LABELS[position] || position}</p>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-ink-50">
                    <th className="text-left px-4 py-2 text-xs font-medium text-ink-400">Ad Unit</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-ink-400">Network</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-ink-400">Site</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-ink-400">Impr.</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-ink-400">Clicks</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-ink-400">eCPM</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-ink-400">Revenue</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-ink-400">Set Network</th>
                  </tr></thead>
                  <tbody>
                    {units.map(unit => {
                      const perf = perfByUnit[unit.id] || { impressions: 0, clicks: 0, revenue: 0 }
                      const eCPM = perf.impressions > 0 ? ((perf.revenue / perf.impressions) * 1000).toFixed(2) : '—'
                      const ctr = perf.impressions > 0 ? ((perf.clicks / perf.impressions) * 100).toFixed(1) : '—'
                      const isTopPerformer = perf.revenue > 0 && units.every(u => u.id === unit.id || (perfByUnit[u.id]?.revenue || 0) <= perf.revenue)
                      return (
                        <tr key={unit.id} className={`border-b border-ink-50 hover:bg-ink-50/50 ${isTopPerformer && perf.revenue > 0 ? 'bg-green-50/30' : ''}`}>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              {isTopPerformer && perf.revenue > 0 && <span title="Top performer">🏆</span>}
                              <p className="text-xs font-medium text-ink-900">{unit.name}</p>
                            </div>
                            <p className="text-xs text-ink-400">{unit.size_width}×{unit.size_height}</p>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${NETWORK_COLORS[unit.network_name] || NETWORK_COLORS.other}`}>
                              {unit.network_name || 'unknown'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-xs text-ink-400 truncate max-w-[120px]">
                            {unit.site_url?.replace(/https?:\/\//, '') || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs text-ink-600">{perf.impressions.toLocaleString() || '—'}</td>
                          <td className="px-3 py-2.5 text-right text-xs text-ink-600">{ctr !== '—' ? `${ctr}%` : '—'}</td>
                          <td className="px-3 py-2.5 text-right text-xs font-medium text-amber-600">{eCPM !== '—' ? `$${eCPM}` : '—'}</td>
                          <td className="px-3 py-2.5 text-right text-xs font-medium text-green-600">
                            {perf.revenue > 0 ? `$${perf.revenue.toFixed(2)}` : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <select
                              value={unit.network_name || 'other'}
                              onChange={e => updateUnitNetwork(unit.id, e.target.value)}
                              className="text-xs border border-ink-200 rounded-lg px-2 py-1 bg-white text-ink-700">
                              {NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Optimization suggestions */}
          <div className="card p-5">
            <h3 className="font-semibold text-ink-900 mb-3">🔍 Optimization Insights</h3>
            <div className="space-y-2">
              {Object.entries(groupedUnits).map(([position, units]) => {
                if (units.length < 2) return null
                const withPerf = units.map(u => ({ ...u, revenue: perfByUnit[u.id]?.revenue || 0, impressions: perfByUnit[u.id]?.impressions || 0 })).filter(u => u.impressions > 0)
                if (withPerf.length < 2) return null
                const best = withPerf.reduce((a, b) => (a.revenue / a.impressions) > (b.revenue / b.impressions) ? a : b)
                const worst = withPerf.reduce((a, b) => (a.revenue / a.impressions) < (b.revenue / b.impressions) ? a : b)
                return (
                  <div key={position} className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <span className="text-amber-500 mt-0.5">💡</span>
                    <p className="text-xs text-amber-800">
                      <strong>{POSITION_LABELS[position]}:</strong> {best.name} ({best.network_name}) is outperforming {worst.name} ({worst.network_name}).
                      Consider pausing {worst.name} or replacing it with a different advertiser.
                    </p>
                  </div>
                )
              })}
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-xs text-blue-700">
                  <strong>📊 Tip:</strong> Performance data populates once ad unit tracking is active. Import daily stats from your network dashboards or connect the Adsterra API for automatic sync.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SEGMENTS ── */}
      {activeTab === 'segments' && (
        <div className="space-y-4">
          {showSegForm && (
            <div className="card p-5 space-y-4 border-2 border-accent/20">
              <h3 className="font-semibold text-ink-900">New Audience Segment</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Name *</label><input className="input" value={segForm.name} onChange={e => setSegForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Karnataka Mobile Readers" /></div>
                <div><label className="label">Description</label><input className="input" value={segForm.description} onChange={e => setSegForm(f => ({ ...f, description: e.target.value }))} /></div>
              </div>
              {[
                { label: '🌍 Countries', field: 'countries', items: COUNTRIES, color: 'bg-blue-600' },
                { label: '🗺 States', field: 'states', items: INDIAN_STATES, color: 'bg-violet-600' },
                { label: '📍 Cities', field: 'cities', items: CITIES, color: 'bg-green-600' },
                { label: '📱 Devices', field: 'devices', items: DEVICES, color: 'bg-amber-500' },
                { label: '🏷 Interests', field: 'interests', items: INTERESTS, color: 'bg-red-500' },
              ].map(group => (
                <div key={group.field}>
                  <label className="label">{group.label}</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {group.items.map(item => {
                      const arr = (segForm.conditions as any)[group.field] as string[]
                      const selected = arr.includes(item)
                      return (
                        <button key={item} onClick={() => toggleCond(group.field, item)}
                          className={`text-xs px-3 py-1 rounded-full border capitalize transition-colors ${selected ? `${group.color} text-white border-transparent` : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300'}`}>
                          {item}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div className="w-48">
                <label className="label">Min. Page Views</label>
                <input type="number" className="input" min={0} value={segForm.conditions.min_page_views}
                  onChange={e => setSegForm(f => ({ ...f, conditions: { ...f.conditions, min_page_views: parseInt(e.target.value) || 0 } }))} />
              </div>
              <div className="flex gap-3">
                <button onClick={saveSeg} className="btn-primary">Save Segment</button>
                <button onClick={() => { setShowSegForm(false); setSegForm({ ...EMPTY_SEG }) }} className="px-4 py-2 text-sm bg-ink-100 text-ink-600 rounded-xl">Cancel</button>
              </div>
            </div>
          )}
          {segments.length === 0 && !showSegForm ? (
            <div className="card p-8 text-center"><p className="text-2xl mb-2">👥</p><p className="text-sm text-ink-500">No segments yet</p></div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {segments.map(seg => (
                <div key={seg.id} className="card p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div><p className="font-semibold text-ink-900">{seg.name}</p></div>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{seg.profile_count} readers</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {seg.conditions.countries?.map(c => <span key={c} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">🌍 {c}</span>)}
                    {seg.conditions.states?.map(s => <span key={s} className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">🗺 {s}</span>)}
                    {seg.conditions.cities?.map(c => <span key={c} className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">📍 {c}</span>)}
                    {seg.conditions.devices?.map(d => <span key={d} className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full capitalize">📱 {d}</span>)}
                    {seg.conditions.interests?.map(i => <span key={i} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">🏷 {i}</span>)}
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
