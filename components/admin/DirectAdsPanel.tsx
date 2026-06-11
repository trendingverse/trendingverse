'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface AdUnit {
  id: string; name: string; position: string
  size_width: number; size_height: number
  is_active: boolean; network_name: string; site_url: string; ad_code: string
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
  target_site_urls?: string[]; target_countries?: string[]; target_states?: string[]
  target_cities?: string[]; target_gender?: string
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
const NETWORKS = ['adsterra', 'adsense', 'medianet', 'taboola', 'mgid', 'direct', 'other']
const DEVICES = ['mobile', 'desktop', 'tablet']
const INTERESTS = ['Karnataka', 'Politics', 'Entertainment', 'Sports', 'Technology', 'Business', 'Health', 'Education', 'Astro', 'Crime', 'Local News']
const INDIAN_STATES = ['Karnataka', 'Tamil Nadu', 'Andhra Pradesh', 'Telangana', 'Kerala', 'Maharashtra', 'Gujarat', 'West Bengal', 'Punjab', 'Rajasthan', 'Uttar Pradesh', 'Bihar', 'Delhi', 'Haryana', 'Madhya Pradesh', 'Odisha', 'Goa']

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
  target_site_urls: [] as string[], target_countries: [] as string[],
  target_states: [] as string[], target_cities: [] as string[], target_gender: 'all',
  campaign_objective: 'impressions', target_impressions: 0, freq_cap_per_user: 0,
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
  const [editingAd, setEditingAd] = useState<DirectAd | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [geoCountries, setGeoCountries] = useState<string[]>([])
  const [geoStates, setGeoStates] = useState<string[]>([])
  const [geoCities, setGeoCities] = useState<string[]>([])
  const [geoLoadingStates, setGeoLoadingStates] = useState(false)
  const [geoLoadingCities, setGeoLoadingCities] = useState(false)
  const [geoSearch, setGeoSearch] = useState({ country: '', state: '', city: '' })
  // Keep geoData for backwards compat in segments tab
  const geoData = { countries: geoCountries, states: geoStates, cities: geoCities }
  const [siteInput, setSiteInput] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [publisherSites, setPublisherSites] = useState<{ domain: string; name: string; articles_count: number }[]>([])
  const [collapsePublishers, setCollapsePublishers] = useState(true)
  const [collapseCountries, setCollapseCountries] = useState(true)
  const [collapseStates, setCollapseStates] = useState(true)
  const [collapseCities, setCollapseCities] = useState(true)
  const [editCollapsePublishers, setEditCollapsePublishers] = useState(true)
  const [editCollapseCountries, setEditCollapseCountries] = useState(true)
  const [reportModal, setReportModal] = useState<DirectAd | null>(null)
  const [reportEmail, setReportEmail] = useState('')
  const [reportData, setReportData] = useState<any>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [sendingReport, setSendingReport] = useState(false)
  const [reportCollapse, setReportCollapse] = useState({
    summary: false,
    by_site: true,
    by_day: true,
    by_country: true,
    by_state: true,
    by_city: true,
  })

  useEffect(() => { fetchAll(); fetchGeoData(); fetchPublisherSites() }, [])
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

  async function fetchGeoData() {
    try {
      const res = await fetch('/api/audience/geo-data')
      if (res.ok) {
        const data = await res.json()
        setGeoCountries(Array.isArray(data.countries) ? data.countries : [])
        setGeoStates([])
        setGeoCities([])
      }
    } catch { /* silent */ }
  }

  async function fetchStatesForCountries(countries: string[]) {
    if (countries.length === 0) { setGeoStates([]); setGeoCities([]); return }
    setGeoLoadingStates(true)
    setGeoStates([])
    setGeoCities([])
    try {
      const params = countries.map(c => `country=${encodeURIComponent(c)}`).join('&')
      const res = await fetch(`/api/audience/geo-data?${params}`)
      if (res.ok) {
        const data = await res.json()
        setGeoStates(data.states || [])
      }
    } catch { /* silent */ }
    setGeoLoadingStates(false)
  }

  async function fetchCitiesForStates(states: string[], countries: string[]) {
    if (states.length === 0 && countries.length === 0) { setGeoCities([]); return }
    setGeoLoadingCities(true)
    setGeoCities([])
    try {
      const stateParams = states.map(s => `state=${encodeURIComponent(s)}`).join('&')
      const countryParams = countries.map(c => `country=${encodeURIComponent(c)}`).join('&')
      const params = stateParams || countryParams
      const res = await fetch(`/api/audience/geo-data?${params}`)
      if (res.ok) {
        const data = await res.json()
        setGeoCities(data.cities || [])
      }
    } catch { /* silent */ }
    setGeoLoadingCities(false)
  }

  async function fetchPublisherSites() {
    try {
      const res = await fetch('/api/sites')
      if (res.ok) {
        const data = await res.json()
        const arr = Array.isArray(data) ? data : (data.sites || data.data || [])
        const sites = arr.map((s: any) => ({
          domain: (s.site_url || s.url || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase(),
          name: s.name || (s.site_url || '').replace(/^https?:\/\//, '') || 'Unknown',
          articles_count: s.articles_count || 0,
        })).filter((s: any) => s.domain)
        setPublisherSites(sites)
      }
    } catch { /* silent */ }
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

  function toggleGeo(field: 'target_countries' | 'target_states' | 'target_cities', val: string) {
    setAdForm((f: any) => {
      const newVal = f[field].includes(val) ? f[field].filter((x: string) => x !== val) : [...f[field], val]
      const updated = { ...f, [field]: newVal }
      if (field === 'target_countries') {
        updated.target_states = []
        updated.target_cities = []
        if (newVal.length > 0) {
          fetchStatesForCountries(newVal)
          setCollapseStates(false) // auto-expand states
          setCollapseCities(true)
        } else {
          setGeoStates([])
          setGeoCities([])
          setCollapseStates(true)
          setCollapseCities(true)
        }
      }
      if (field === 'target_states') {
        updated.target_cities = []
        if (newVal.length > 0) {
          fetchCitiesForStates(newVal, f.target_countries)
          setCollapseCities(false) // auto-expand cities
        } else {
          setGeoCities([])
          setCollapseCities(true)
        }
      }
      return updated
    })
  }

  function addSite() {
    const s = siteInput.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (!s) return
    setAdForm((f: any) => ({ ...f, target_site_urls: [...new Set([...(f.target_site_urls || []), s])] }))
    setSiteInput('')
  }

  function toggleCond(field: string, val: string) {
    const arr = (segForm.conditions as any)[field] as string[]
    setSegForm(f => ({ ...f, conditions: { ...f.conditions, [field]: arr.includes(val) ? arr.filter((x: string) => x !== val) : [...arr, val] } }))
  }

  async function openReport(ad: DirectAd) {
    setReportModal(ad)
    setReportData(null)
    setReportLoading(true)
    const res = await fetch(`/api/audience/track/campaign-report?id=${ad.id}`)
    if (res.ok) setReportData(await res.json())
    setReportLoading(false)
  }

  function downloadReportCSV() {
    if (!reportData) return
    const { campaign, summary, by_site, by_day } = reportData
    const { by_country, by_state, by_city } = reportData
    const rows = [
      ['Campaign Report', campaign.name],
      ['Status', campaign.status],
      ['Period', `${campaign.start_date || 'N/A'} to ${campaign.end_date || 'Ongoing'}`],
      [''],
      ['SUMMARY', ''],
      ['Impressions', summary.impressions],
      ['Clicks', summary.clicks],
      ['CTR', summary.ctr + '%'],
      ['Earned (₹)', summary.earned_inr],
      [''],
      ['BY SITE', 'Impressions', 'Clicks', 'CTR'],
      ...by_site.map((s: any) => [s.site, s.impressions, s.clicks, s.ctr + '%']),
      [''],
      ['BY COUNTRY', 'Impressions'],
      ...(by_country || []).map((c: any) => [c.country, c.impressions]),
      [''],
      ['BY STATE', 'Impressions'],
      ...(by_state || []).map((s: any) => [s.state, s.impressions]),
      [''],
      ['BY CITY', 'Impressions'],
      ...(by_city || []).map((c: any) => [c.city, c.impressions]),
      [''],
      ['BY DAY', 'Impressions', 'Clicks'],
      ...by_day.map((d: any) => [d.date, d.impressions, d.clicks]),
    ]
    const csv = rows.map(r => r.map(v => `"${(v||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Campaign-Report-${campaign.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    toast.success('Report downloaded!')
  }

  async function emailReport() {
    if (!reportEmail || !reportModal) return
    setSendingReport(true)
    const res = await fetch('/api/audience/track/campaign-report', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: reportModal.id, email: reportEmail }),
    })
    if (res.ok) { toast.success(`Report sent to ${reportEmail}!`); setReportModal(null) }
    else { const d = await res.json(); toast.error(d.error || 'Send failed') }
    setSendingReport(false)
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

  async function updateAd() {
    if (!editingAd) return
    setSavingEdit(true)
    const res = await fetch('/api/audience/direct-ads', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingAd.id, ...editForm }),
    })
    if (res.ok) {
      toast.success('Campaign updated!')
      setAds(prev => prev.map(a => a.id === editingAd.id ? { ...a, ...editForm } : a))
      setEditingAd(null)
    } else toast.error('Failed to update')
    setSavingEdit(false)
  }

  function openEdit(ad: DirectAd) {
    setEditingAd(ad)
    setEditForm({
      campaign_name: ad.campaign_name || '',
      campaign_notes: ad.campaign_notes || '',
      headline: ad.headline || '',
      description: ad.description || '',
      destination_url: ad.destination_url || '',
      cta_text: ad.cta_text || '',
      image_url: ad.image_url || '',
      priority: ad.priority || 0,
      cpm_rate_inr: ad.cpm_rate_inr || 0,
      impressions_cap: ad.impressions_cap || 0,
      start_date: ad.start_date || '',
      end_date: ad.end_date || '',
      target_site_urls: ad.target_site_urls || [],
      target_countries: ad.target_countries || [],
      target_states: ad.target_states || [],
      target_cities: ad.target_cities || [],
      target_gender: ad.target_gender || 'all',
    })
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

  const groupedUnits = adUnits.reduce((acc, unit) => {
    const pos = unit.position || 'other'
    if (!acc[pos]) acc[pos] = []
    acc[pos].push(unit)
    return acc
  }, {} as Record<string, AdUnit[]>)

  const perfByUnit = performance.reduce((acc, p) => {
    if (!acc[p.ad_unit_id]) acc[p.ad_unit_id] = { impressions: 0, clicks: 0, revenue: 0 }
    acc[p.ad_unit_id].impressions += p.impressions
    acc[p.ad_unit_id].clicks += p.clicks
    acc[p.ad_unit_id].revenue += p.revenue_usd
    return acc
  }, {} as Record<string, { impressions: number; clicks: number; revenue: number }>)

  const filteredAds = statusFilter === 'all' ? ads : ads.filter(a => getStatus(a) === statusFilter)
  const counts = { all: ads.length, active: ads.filter(a => getStatus(a) === 'active').length, scheduled: ads.filter(a => getStatus(a) === 'scheduled').length, paused: ads.filter(a => getStatus(a) === 'paused').length, ended: ads.filter(a => getStatus(a) === 'ended').length }

  // Geo filter helpers
  const filteredCountries = geoData.countries.filter(c => c.toLowerCase().includes(geoSearch.country.toLowerCase()))
  const filteredStates = geoData.states.filter(s => s.toLowerCase().includes(geoSearch.state.toLowerCase()))
  const filteredCities = geoData.cities.filter(c => c.toLowerCase().includes(geoSearch.city.toLowerCase()))

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
          <button onClick={() => { setShowAdForm(true); setEditingAd(null) }} className="btn-primary text-xs px-4 py-2">+ New Campaign</button>
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
                  placeholder="e.g. TrendingVerse Publisher Signup — Kannadadunia" />
              </div>

              {/* STEP 1 — Ad Units */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                  <p className="text-sm font-semibold text-ink-900">Select Ad Units</p>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <input type="checkbox" checked={adForm.target_all}
                    onChange={e => setAdForm((f: any) => ({ ...f, target_all: e.target.checked, target_ad_unit_ids: [] }))} className="w-4 h-4 accent-accent" />
                  <label className="text-sm text-ink-700">Run on <strong>all ad units</strong> across all sites</label>
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
                                className={`text-left p-3 rounded-xl border transition-all ${selected ? 'border-accent bg-accent/5' : 'border-ink-200 hover:border-ink-300'}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-semibold text-ink-900">{unit.name}</p>
                                  {selected && <span className="text-accent shrink-0">✓</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${NETWORK_COLORS[unit.network_name] || NETWORK_COLORS.other}`}>{unit.network_name || 'unknown'}</span>
                                  <span className="text-[10px] text-ink-400">{unit.size_width}×{unit.size_height}</span>
                                  {unit.site_url && <span className="text-[10px] text-ink-400 truncate max-w-[100px]">{unit.site_url.replace(/https?:\/\//, '')}</span>}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* STEP 2 — Creative */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                  <p className="text-sm font-semibold text-ink-900">Ad Creative</p>
                </div>
                <div className="flex gap-2 mb-3">
                  {[
                    { k: 'script', l: '📜 Ad Script' }, { k: 'banner', l: '🖼 Banner' },
                    { k: 'text', l: '📝 Text Ad' }, { k: 'native', l: '📰 Native' },
                  ].map(opt => (
                    <button key={opt.k} onClick={() => setAdForm((f: any) => ({ ...f, ad_type: opt.k }))}
                      className={`flex-1 p-2.5 rounded-xl border text-xs text-left transition-colors ${adForm.ad_type === opt.k ? 'border-accent bg-accent/5' : 'border-ink-200'}`}>
                      <p className="font-semibold text-ink-900">{opt.l}</p>
                    </button>
                  ))}
                </div>
                {adForm.ad_type !== 'script' && (
                  <div className="flex justify-end mb-2">
                    <button onClick={() => setShowPreview(v => !v)}
                      className="text-xs px-3 py-1.5 bg-ink-100 text-ink-700 rounded-lg hover:bg-ink-200">
                      {showPreview ? '✕ Hide Preview' : '👁 Preview Ad'}
                    </button>
                  </div>
                )}

                {showPreview && adForm.ad_type !== 'script' && (
                  <div className="mb-3 p-4 bg-ink-950 rounded-xl flex items-center justify-center">
                    <div style={{ width: Math.min(adForm.size_width || 300, 280), background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                      {adForm.image_url && (adForm.ad_type === 'banner' || adForm.ad_type === 'native') && (
                        <img src={adForm.image_url} alt="Ad preview" style={{ width: '100%', display: 'block', maxHeight: 150, objectFit: 'cover' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      )}
                      <div style={{ padding: '10px 12px' }}>
                        {adForm.headline && <p style={{ fontSize: 13, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>{adForm.headline}</p>}
                        {adForm.description && <p style={{ fontSize: 11, color: '#666', margin: '0 0 8px', lineHeight: 1.4 }}>{adForm.description}</p>}
                        {adForm.cta_text && (
                          <span style={{ display: 'inline-block', background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 6 }}>
                            {adForm.cta_text}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-ink-500 mt-2 text-center ml-3">Preview</p>
                  </div>
                )}

                {adForm.ad_type === 'script' ? (
                  <div>
                    <label className="label">Ad Script *</label>
                    <textarea className="input font-mono text-xs resize-none" rows={6}
                      value={adForm.ad_code_override || ''}
                      onChange={e => setAdForm((f: any) => ({ ...f, ad_code_override: e.target.value }))}
                      placeholder={'<script>\n  // Paste advertiser script here\n</script>'} />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">Headline</label><input className="input" value={adForm.headline} onChange={e => setAdForm((f: any) => ({ ...f, headline: e.target.value }))} /></div>
                    <div><label className="label">CTA Text</label><input className="input" value={adForm.cta_text} onChange={e => setAdForm((f: any) => ({ ...f, cta_text: e.target.value }))} /></div>
                    {adForm.ad_type !== 'text' && (
                      <div className="col-span-2"><label className="label">Image URL</label><input className="input" value={adForm.image_url} onChange={e => setAdForm((f: any) => ({ ...f, image_url: e.target.value }))} placeholder="https://example.com/banner.jpg" /></div>
                    )}
                    <div className="col-span-2"><label className="label">Description</label><input className="input" value={adForm.description} onChange={e => setAdForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
                    <div className="col-span-2"><label className="label">Destination URL *</label><input className="input" value={adForm.destination_url} onChange={e => setAdForm((f: any) => ({ ...f, destination_url: e.target.value }))} placeholder="https://advertiser.com" /></div>
                  </div>
                )}
              </div>

              {/* STEP 3 — Targeting */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                  <p className="text-sm font-semibold text-ink-900">Targeting <span className="text-ink-400 font-normal text-xs">(optional)</span></p>
                </div>

                <div className="space-y-4">
                  {/* Site targeting — collapsible publisher list */}
                  <div className="border border-ink-200 rounded-xl overflow-hidden">
                    <button onClick={() => setCollapsePublishers(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-ink-50 hover:bg-ink-100 transition-colors">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-ink-700">🌐 Site Targeting</p>
                        {adForm.target_site_urls?.length > 0 && (
                          <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{adForm.target_site_urls.length} selected</span>
                        )}
                      </div>
                      <span className="text-ink-400 text-xs">{collapsePublishers ? '▼ Show' : '▲ Hide'}</span>
                    </button>
                    {!collapsePublishers && (
                      <div className="p-3 space-y-2">
                        <p className="text-xs text-ink-400">Select publisher sites. Leave empty to run on all sites.</p>
                        {publisherSites.map(site => {
                          const selected = adForm.target_site_urls?.includes(site.domain)
                          return (
                            <button key={site.domain} onClick={() => setAdForm((f: any) => ({
                              ...f,
                              target_site_urls: selected
                                ? f.target_site_urls.filter((x: string) => x !== site.domain)
                                : [...(f.target_site_urls || []), site.domain]
                            }))}
                              className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${selected ? 'border-violet-400 bg-violet-50' : 'border-ink-200 hover:border-ink-300'}`}>
                              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ? 'bg-violet-600 border-violet-600' : 'border-ink-300'}`}>
                                {selected && <span className="text-white text-[10px]">✓</span>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-ink-900">{site.name}</p>
                                <p className="text-xs text-ink-400">{site.domain}</p>
                              </div>
                              <span className="text-[10px] bg-ink-100 text-ink-500 px-2 py-0.5 rounded-full">{site.articles_count || 0} articles</span>
                            </button>
                          )
                        })}
                        {publisherSites.length === 0 && <p className="text-xs text-ink-400 bg-ink-50 p-3 rounded-lg">No onboarded publishers yet</p>}
                      </div>
                    )}
                    {adForm.target_site_urls?.length > 0 && collapsePublishers && (
                      <div className="px-4 py-2 border-t border-ink-100">
                        <p className="text-xs text-violet-600">✓ {adForm.target_site_urls.join(', ')}</p>
                      </div>
                    )}
                  </div>

                  {/* Gender targeting */}
                  <div className="p-4 border border-ink-200 rounded-xl space-y-2">
                    <p className="text-xs font-semibold text-ink-700">👤 Gender</p>
                    <div className="flex gap-2">
                      {[{ k: 'all', l: 'All' }, { k: 'male', l: 'Male' }, { k: 'female', l: 'Female' }, { k: 'other', l: 'Other' }].map(g => (
                        <button key={g.k} onClick={() => setAdForm((f: any) => ({ ...f, target_gender: g.k }))}
                          className={`text-xs px-4 py-2 rounded-xl border transition-colors ${adForm.target_gender === g.k ? 'border-accent bg-accent/5 text-accent font-semibold' : 'border-ink-200 text-ink-600'}`}>
                          {g.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Geo targeting — collapsible */}
                  {/* COUNTRY — always shown */}
                  <div className="border border-ink-200 rounded-xl overflow-hidden">
                    <button onClick={() => setCollapseCountries(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-ink-50 hover:bg-ink-100 transition-colors">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-ink-700">🌍 Country</p>
                        {adForm.target_countries?.length > 0
                          ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{adForm.target_countries.join(', ')}</span>
                          : <span className="text-[10px] text-ink-400">{geoCountries.length} available · select to filter states</span>}
                      </div>
                      <span className="text-ink-400 text-xs">{collapseCountries ? '▼' : '▲'}</span>
                    </button>
                    {!collapseCountries && (
                      <div className="p-3 space-y-2">
                        <input className="input text-xs w-full" placeholder="Search countries..."
                          value={geoSearch.country} onChange={e => setGeoSearch(s => ({ ...s, country: e.target.value }))} />
                        {geoCountries.length === 0 ? (
                          <p className="text-xs text-ink-400 bg-ink-50 p-2 rounded-lg">No audience data yet</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                            {geoCountries.filter(c => c.toLowerCase().includes(geoSearch.country.toLowerCase())).map(c => (
                              <button key={c} onClick={() => toggleGeo('target_countries', c)}
                                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${adForm.target_countries.includes(c) ? 'bg-blue-600 text-white border-transparent' : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300'}`}>
                                {c}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* STATE — only shown after country selected */}
                  {adForm.target_countries?.length > 0 && (
                    <div className="border border-ink-200 rounded-xl overflow-hidden">
                      <button onClick={() => setCollapseStates(v => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-ink-50 hover:bg-ink-100 transition-colors">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-ink-700">🗺 State / Region</p>
                          {geoLoadingStates && <span className="text-[10px] text-ink-400 animate-pulse">Loading...</span>}
                          {!geoLoadingStates && adForm.target_states?.length > 0
                            ? <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{adForm.target_states.join(', ')}</span>
                            : !geoLoadingStates && <span className="text-[10px] text-ink-400">{geoStates.length} available · select to filter cities</span>}
                        </div>
                        <span className="text-ink-400 text-xs">{collapseStates ? '▼' : '▲'}</span>
                      </button>
                      {!collapseStates && (
                        <div className="p-3 space-y-2">
                          <input className="input text-xs w-full" placeholder="Search states..."
                            value={geoSearch.state} onChange={e => setGeoSearch(s => ({ ...s, state: e.target.value }))} />
                          {geoLoadingStates ? (
                            <p className="text-xs text-ink-400 animate-pulse p-2">Loading states...</p>
                          ) : geoStates.length === 0 ? (
                            <p className="text-xs text-ink-400 bg-ink-50 p-2 rounded-lg">No state data for selected countries</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                              {geoStates.filter(s => s.toLowerCase().includes(geoSearch.state.toLowerCase())).map(s => (
                                <button key={s} onClick={() => toggleGeo('target_states', s)}
                                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${adForm.target_states.includes(s) ? 'bg-violet-600 text-white border-transparent' : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300'}`}>
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* CITY — only shown after state selected */}
                  {adForm.target_states?.length > 0 && (
                    <div className="border border-ink-200 rounded-xl overflow-hidden">
                      <button onClick={() => setCollapseCities(v => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-ink-50 hover:bg-ink-100 transition-colors">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-ink-700">📍 City</p>
                          {geoLoadingCities && <span className="text-[10px] text-ink-400 animate-pulse">Loading...</span>}
                          {!geoLoadingCities && adForm.target_cities?.length > 0
                            ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{adForm.target_cities.join(', ')}</span>
                            : !geoLoadingCities && <span className="text-[10px] text-ink-400">{geoCities.length} available</span>}
                        </div>
                        <span className="text-ink-400 text-xs">{collapseCities ? '▼' : '▲'}</span>
                      </button>
                      {!collapseCities && (
                        <div className="p-3 space-y-2">
                          <input className="input text-xs w-full" placeholder="Search cities..."
                            value={geoSearch.city} onChange={e => setGeoSearch(s => ({ ...s, city: e.target.value }))} />
                          {geoLoadingCities ? (
                            <p className="text-xs text-ink-400 animate-pulse p-2">Loading cities...</p>
                          ) : geoCities.length === 0 ? (
                            <p className="text-xs text-ink-400 bg-ink-50 p-2 rounded-lg">No city data for selected states</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                              {geoCities.filter(c => c.toLowerCase().includes(geoSearch.city.toLowerCase())).map(c => (
                                <button key={c} onClick={() => toggleGeo('target_cities', c)}
                                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${adForm.target_cities.includes(c) ? 'bg-green-600 text-white border-transparent' : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300'}`}>
                                  {c}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Audience segments */}
                  {segments.length > 0 && (
                    <div className="p-4 border border-ink-200 rounded-xl space-y-2">
                      <p className="text-xs font-semibold text-ink-700">👥 Audience Segments</p>
                      <div className="grid grid-cols-2 gap-2">
                        {segments.map(seg => (
                          <button key={seg.id} onClick={() => toggleSeg(seg.id)}
                            className={`text-left p-3 rounded-xl border text-xs transition-colors ${adForm.segment_ids.includes(seg.id) ? 'border-accent bg-accent/5' : 'border-ink-100 hover:border-ink-200'}`}>
                            <p className="font-medium text-ink-900">{seg.name}</p>
                            <p className="text-ink-400">{seg.profile_count} readers</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* STEP 4 — Schedule */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">4</span>
                  <p className="text-sm font-semibold text-ink-900">Campaign Objective & Schedule</p>
                </div>

                {/* Campaign Objective */}
                <div className="mb-4">
                  <label className="label">Campaign Objective</label>
                  <div className="flex gap-2">
                    {[
                      { k: 'impressions', l: '👁 Impressions', sub: 'Maximize ad views' },
                      { k: 'clicks', l: '🖱 Clicks', sub: 'Drive traffic' },
                      { k: 'awareness', l: '📢 Awareness', sub: 'Brand visibility' },
                    ].map(opt => (
                      <button key={opt.k} onClick={() => setAdForm((f: any) => ({ ...f, campaign_objective: opt.k }))}
                        className={`flex-1 p-2.5 rounded-xl border text-xs text-left transition-colors ${adForm.campaign_objective === opt.k ? 'border-accent bg-accent/5' : 'border-ink-200 hover:border-ink-300'}`}>
                        <p className="font-semibold text-ink-900">{opt.l}</p>
                        <p className="text-ink-400 mt-0.5">{opt.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div><label className="label">Start Date</label><input type="date" className="input" value={adForm.start_date} onChange={e => setAdForm((f: any) => ({ ...f, start_date: e.target.value }))} /></div>
                  <div><label className="label">End Date</label><input type="date" className="input" value={adForm.end_date} onChange={e => setAdForm((f: any) => ({ ...f, end_date: e.target.value }))} /></div>
                  <div><label className="label">CPM Rate (₹)</label><input type="number" className="input" min={0} step="0.01" value={adForm.cpm_rate_inr} onChange={e => setAdForm((f: any) => ({ ...f, cpm_rate_inr: parseFloat(e.target.value) || 0 }))} /></div>
                  <div><label className="label">Priority (0–100)</label><input type="number" className="input" min={0} max={100} value={adForm.priority} onChange={e => setAdForm((f: any) => ({ ...f, priority: parseInt(e.target.value) || 0 }))} /></div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="label">Target Impressions</label>
                    <input type="number" className="input" min={0} value={adForm.target_impressions}
                      onChange={e => setAdForm((f: any) => ({ ...f, target_impressions: parseInt(e.target.value) || 0 }))}
                      placeholder="0 = unlimited" />
                    <p className="text-[10px] text-ink-400 mt-1">Campaign stops when target is reached</p>
                  </div>
                  <div>
                    <label className="label">Total Impression Cap</label>
                    <input type="number" className="input" min={0} value={adForm.impressions_cap}
                      onChange={e => setAdForm((f: any) => ({ ...f, impressions_cap: parseInt(e.target.value) || 0 }))}
                      placeholder="0 = ∞" />
                    <p className="text-[10px] text-ink-400 mt-1">Hard limit across all visitors</p>
                  </div>
                  <div>
                    <label className="label">Freq. Cap (per user)</label>
                    <input type="number" className="input" min={0} value={adForm.freq_cap_per_user}
                      onChange={e => setAdForm((f: any) => ({ ...f, freq_cap_per_user: parseInt(e.target.value) || 0 }))}
                      placeholder="0 = unlimited" />
                    <p className="text-[10px] text-ink-400 mt-1">Max times same visitor sees this ad</p>
                  </div>
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
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Targeting</th>
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
                    const sites = ad.target_site_urls?.length ? ad.target_site_urls.join(', ') : null
                    const geo = [...(ad.target_countries || []), ...(ad.target_states || []), ...(ad.target_cities || [])].slice(0, 2).join(', ')
                    return (
                      <tr key={ad.id} className={`border-b border-ink-50 hover:bg-ink-50/50 ${status === 'ended' ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="text-xs font-semibold text-ink-900">{ad.campaign_name}</p>
                          {sites && <p className="text-xs text-violet-600 truncate">🌐 {sites}</p>}
                          {ad.campaign_notes && <p className="text-xs text-ink-300 truncate">{ad.campaign_notes}</p>}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[status]}`}>{status}</span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            {ad.target_gender && ad.target_gender !== 'all' && <span className="text-[10px] bg-pink-50 text-pink-700 px-1.5 py-0.5 rounded-full capitalize">{ad.target_gender}</span>}
                            {geo && <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full truncate max-w-[80px]">{geo}</span>}
                            {!geo && (!ad.target_gender || ad.target_gender === 'all') && <span className="text-[10px] text-ink-400">All</span>}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-ink-500">{ad.start_date || '—'}{ad.end_date ? ` → ${ad.end_date}` : ''}</td>
                        <td className="px-3 py-3 text-right text-xs">{(ad.impressions || 0).toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-xs font-medium text-green-600">{ctr}%</td>
                        <td className="px-3 py-3 text-right text-xs font-medium text-amber-600">{ad.cpm_rate_inr > 0 ? `₹${earned.toLocaleString()}` : '—'}</td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openReport(ad)} className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" title="View Report">📊</button>
                            <button onClick={() => openEdit(ad)} className="text-xs px-2 py-1 rounded-lg bg-ink-100 text-ink-600 hover:bg-ink-200">✏</button>
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
                    <th className="text-right px-3 py-2 text-xs font-medium text-ink-400">CTR</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-ink-400">eCPM</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-ink-400">Revenue</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-ink-400">Set Network</th>
                  </tr></thead>
                  <tbody>
                    {units.map(unit => {
                      const perf = perfByUnit[unit.id] || { impressions: 0, clicks: 0, revenue: 0 }
                      const eCPM = perf.impressions > 0 ? ((perf.revenue / perf.impressions) * 1000).toFixed(2) : '—'
                      const ctr = perf.impressions > 0 ? ((perf.clicks / perf.impressions) * 100).toFixed(1) : '—'
                      return (
                        <tr key={unit.id} className="border-b border-ink-50 hover:bg-ink-50/50">
                          <td className="px-4 py-2.5">
                            <p className="text-xs font-medium text-ink-900">{unit.name}</p>
                            <p className="text-xs text-ink-400">{unit.size_width}×{unit.size_height}</p>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${NETWORK_COLORS[unit.network_name] || NETWORK_COLORS.other}`}>{unit.network_name || 'unknown'}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-xs text-ink-400">{unit.site_url?.replace(/https?:\/\//, '') || '—'}</td>
                          <td className="px-3 py-2.5 text-right text-xs">{perf.impressions.toLocaleString() || '—'}</td>
                          <td className="px-3 py-2.5 text-right text-xs">{ctr !== '—' ? `${ctr}%` : '—'}</td>
                          <td className="px-3 py-2.5 text-right text-xs font-medium text-amber-600">{eCPM !== '—' ? `$${eCPM}` : '—'}</td>
                          <td className="px-3 py-2.5 text-right text-xs font-medium text-green-600">{perf.revenue > 0 ? `$${perf.revenue.toFixed(2)}` : '—'}</td>
                          <td className="px-3 py-2.5 text-center">
                            <select value={unit.network_name || 'other'} onChange={e => updateUnitNetwork(unit.id, e.target.value)}
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
        </div>
      )}

      {/* ── SEGMENTS ── */}
      {activeTab === 'segments' && (
        <div className="space-y-4">
          {showSegForm && (
            <div className="card p-5 space-y-4 border-2 border-accent/20">
              <h3 className="font-semibold text-ink-900">New Audience Segment</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Name *</label><input className="input" value={segForm.name} onChange={e => setSegForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><label className="label">Description</label><input className="input" value={segForm.description} onChange={e => setSegForm(f => ({ ...f, description: e.target.value }))} /></div>
              </div>
              {[
                { label: '🌍 Countries', field: 'countries', items: geoData.countries.slice(0, 30), color: 'bg-blue-600' },
                { label: '🗺 States', field: 'states', items: [...new Set([...INDIAN_STATES, ...geoData.states.slice(0, 20)])], color: 'bg-violet-600' },
                { label: '📍 Cities', field: 'cities', items: geoData.cities.slice(0, 30), color: 'bg-green-600' },
                { label: '📱 Devices', field: 'devices', items: DEVICES, color: 'bg-amber-500' },
                { label: '🏷 Interests', field: 'interests', items: INTERESTS, color: 'bg-red-500' },
              ].map(group => (
                <div key={group.field}>
                  <label className="label">{group.label}</label>
                  <div className="flex flex-wrap gap-2 mt-1 max-h-24 overflow-y-auto">
                    {group.items.map(item => {
                      const arr = (segForm.conditions as any)[group.field] as string[]
                      const selected = arr.includes(item)
                      return (
                        <button key={item} onClick={() => toggleCond(group.field, item)}
                          className={`text-xs px-3 py-1 rounded-full border capitalize transition-colors ${selected ? `${group.color} text-white border-transparent` : 'bg-white text-ink-600 border-ink-200'}`}>
                          {item}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
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
                    <p className="font-semibold text-ink-900">{seg.name}</p>
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

      {/* ── REPORT MODAL ── */}
      {reportModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setReportModal(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="card p-6 w-full max-w-xl space-y-4 my-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-ink-900">📊 Campaign Report</p>
                  <p className="text-xs text-ink-400">{reportModal.campaign_name}</p>
                </div>
                <button onClick={() => setReportModal(null)} className="text-xs text-ink-400 hover:text-ink-600">✕</button>
              </div>

              {reportLoading ? (
                <div className="h-32 bg-ink-50 rounded-xl flex items-center justify-center">
                  <p className="text-xs text-ink-400 animate-pulse">Loading report...</p>
                </div>
              ) : reportData ? (
                <div className="space-y-2">

                  {/* Summary */}
                  <div className="border border-ink-200 rounded-xl overflow-hidden">
                    <button onClick={() => setReportCollapse(s => ({ ...s, summary: !s.summary }))}
                      className="w-full flex items-center justify-between px-4 py-3 bg-ink-50 hover:bg-ink-100 transition-colors">
                      <p className="text-xs font-semibold text-ink-700">📊 Summary</p>
                      <span className="text-ink-400 text-xs">{reportCollapse.summary ? '▼' : '▲'}</span>
                    </button>
                    {!reportCollapse.summary && (
                      <div className="p-3 grid grid-cols-4 gap-3">
                        {[
                          { l: 'Impressions', v: reportData.summary.impressions.toLocaleString(), color: 'text-ink-900' },
                          { l: 'Clicks', v: reportData.summary.clicks.toLocaleString(), color: 'text-ink-900' },
                          { l: 'CTR', v: reportData.summary.ctr + '%', color: 'text-green-600' },
                          { l: 'Earned', v: '₹' + reportData.summary.earned_inr, color: 'text-amber-600' },
                        ].map(s => (
                          <div key={s.l} className="bg-ink-50 rounded-xl p-3 text-center">
                            <p className={`text-lg font-bold ${s.color}`}>{s.v}</p>
                            <p className="text-xs text-ink-400 mt-0.5">{s.l}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* By Site */}
                  {reportData.by_site?.length > 0 && (
                    <div className="border border-ink-200 rounded-xl overflow-hidden">
                      <button onClick={() => setReportCollapse(s => ({ ...s, by_site: !s.by_site }))}
                        className="w-full flex items-center justify-between px-4 py-3 bg-ink-50 hover:bg-ink-100 transition-colors">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-ink-700">🌐 By Site</p>
                          <span className="text-[10px] text-ink-400">{reportData.by_site.length} sites</span>
                        </div>
                        <span className="text-ink-400 text-xs">{reportCollapse.by_site ? '▼' : '▲'}</span>
                      </button>
                      {!reportCollapse.by_site && (
                        <table className="w-full">
                          <thead><tr className="bg-ink-50 border-t border-ink-100">
                            <th className="text-left px-3 py-2 text-xs font-medium text-ink-500">Site</th>
                            <th className="text-right px-3 py-2 text-xs font-medium text-ink-500">Impr.</th>
                            <th className="text-right px-3 py-2 text-xs font-medium text-ink-500">Clicks</th>
                            <th className="text-right px-3 py-2 text-xs font-medium text-ink-500">CTR</th>
                          </tr></thead>
                          <tbody>
                            {reportData.by_site.map((s: any) => (
                              <tr key={s.site} className="border-t border-ink-50">
                                <td className="px-3 py-2 text-xs text-ink-700 truncate max-w-[160px]">{s.site}</td>
                                <td className="px-3 py-2 text-xs text-right">{s.impressions.toLocaleString()}</td>
                                <td className="px-3 py-2 text-xs text-right">{s.clicks}</td>
                                <td className="px-3 py-2 text-xs text-right text-green-600 font-medium">{s.ctr}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* By Country */}
                  {reportData.by_country?.length > 0 && (
                    <div className="border border-ink-200 rounded-xl overflow-hidden">
                      <button onClick={() => setReportCollapse(s => ({ ...s, by_country: !s.by_country }))}
                        className="w-full flex items-center justify-between px-4 py-3 bg-ink-50 hover:bg-ink-100 transition-colors">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-ink-700">🌍 By Country</p>
                          <span className="text-[10px] text-ink-400">{reportData.by_country.length} countries</span>
                        </div>
                        <span className="text-ink-400 text-xs">{reportCollapse.by_country ? '▼' : '▲'}</span>
                      </button>
                      {!reportCollapse.by_country && (
                        <table className="w-full">
                          <thead><tr className="bg-ink-50 border-t border-ink-100">
                            <th className="text-left px-3 py-2 text-xs font-medium text-ink-500">Country</th>
                            <th className="text-right px-3 py-2 text-xs font-medium text-ink-500">Impressions</th>
                            <th className="text-right px-3 py-2 text-xs font-medium text-ink-500">Share</th>
                          </tr></thead>
                          <tbody>
                            {reportData.by_country.map((c: any) => (
                              <tr key={c.country} className="border-t border-ink-50">
                                <td className="px-3 py-2 text-xs text-ink-700">{c.country}</td>
                                <td className="px-3 py-2 text-xs text-right">{c.impressions.toLocaleString()}</td>
                                <td className="px-3 py-2 text-xs text-right text-blue-600">
                                  {reportData.summary.impressions > 0 ? ((c.impressions / reportData.summary.impressions) * 100).toFixed(1) + '%' : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* By State */}
                  {reportData.by_state?.length > 0 && (
                    <div className="border border-ink-200 rounded-xl overflow-hidden">
                      <button onClick={() => setReportCollapse(s => ({ ...s, by_state: !s.by_state }))}
                        className="w-full flex items-center justify-between px-4 py-3 bg-ink-50 hover:bg-ink-100 transition-colors">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-ink-700">🗺 By State</p>
                          <span className="text-[10px] text-ink-400">{reportData.by_state.length} states</span>
                        </div>
                        <span className="text-ink-400 text-xs">{reportCollapse.by_state ? '▼' : '▲'}</span>
                      </button>
                      {!reportCollapse.by_state && (
                        <div className="max-h-40 overflow-y-auto">
                          <table className="w-full">
                            <thead><tr className="bg-ink-50 border-t border-ink-100 sticky top-0">
                              <th className="text-left px-3 py-2 text-xs font-medium text-ink-500">State</th>
                              <th className="text-right px-3 py-2 text-xs font-medium text-ink-500">Impressions</th>
                            </tr></thead>
                            <tbody>
                              {reportData.by_state.map((s: any) => (
                                <tr key={s.state} className="border-t border-ink-50">
                                  <td className="px-3 py-2 text-xs text-ink-700">{s.state}</td>
                                  <td className="px-3 py-2 text-xs text-right">{s.impressions.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* By City */}
                  {reportData.by_city?.length > 0 && (
                    <div className="border border-ink-200 rounded-xl overflow-hidden">
                      <button onClick={() => setReportCollapse(s => ({ ...s, by_city: !s.by_city }))}
                        className="w-full flex items-center justify-between px-4 py-3 bg-ink-50 hover:bg-ink-100 transition-colors">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-ink-700">📍 By City</p>
                          <span className="text-[10px] text-ink-400">{reportData.by_city.length} cities</span>
                        </div>
                        <span className="text-ink-400 text-xs">{reportCollapse.by_city ? '▼' : '▲'}</span>
                      </button>
                      {!reportCollapse.by_city && (
                        <div className="max-h-40 overflow-y-auto">
                          <table className="w-full">
                            <thead><tr className="bg-ink-50 border-t border-ink-100 sticky top-0">
                              <th className="text-left px-3 py-2 text-xs font-medium text-ink-500">City</th>
                              <th className="text-right px-3 py-2 text-xs font-medium text-ink-500">Impressions</th>
                            </tr></thead>
                            <tbody>
                              {reportData.by_city.map((c: any) => (
                                <tr key={c.city} className="border-t border-ink-50">
                                  <td className="px-3 py-2 text-xs text-ink-700">{c.city}</td>
                                  <td className="px-3 py-2 text-xs text-right">{c.impressions.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* By Day */}
                  {reportData.by_day?.length > 0 && (
                    <div className="border border-ink-200 rounded-xl overflow-hidden">
                      <button onClick={() => setReportCollapse(s => ({ ...s, by_day: !s.by_day }))}
                        className="w-full flex items-center justify-between px-4 py-3 bg-ink-50 hover:bg-ink-100 transition-colors">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-ink-700">📅 Daily Breakdown</p>
                          <span className="text-[10px] text-ink-400">{reportData.by_day.length} days</span>
                        </div>
                        <span className="text-ink-400 text-xs">{reportCollapse.by_day ? '▼' : '▲'}</span>
                      </button>
                      {!reportCollapse.by_day && (
                        <div className="max-h-40 overflow-y-auto">
                          <table className="w-full">
                            <thead><tr className="bg-ink-50 border-t border-ink-100 sticky top-0">
                              <th className="text-left px-3 py-2 text-xs font-medium text-ink-500">Date</th>
                              <th className="text-right px-3 py-2 text-xs font-medium text-ink-500">Impressions</th>
                              <th className="text-right px-3 py-2 text-xs font-medium text-ink-500">Clicks</th>
                            </tr></thead>
                            <tbody>
                              {reportData.by_day.map((d: any) => (
                                <tr key={d.date} className="border-t border-ink-50">
                                  <td className="px-3 py-2 text-xs text-ink-700">{d.date}</td>
                                  <td className="px-3 py-2 text-xs text-right">{d.impressions.toLocaleString()}</td>
                                  <td className="px-3 py-2 text-xs text-right">{d.clicks}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                                    {/* Actions */}
                  <div className="border-t border-ink-100 pt-4 space-y-3">
                    <button onClick={downloadReportCSV} className="w-full text-xs px-4 py-2.5 bg-ink-100 text-ink-700 rounded-xl hover:bg-ink-200 font-medium">
                      ⬇ Download CSV Report
                    </button>
                    <div className="flex gap-2">
                      <input type="email" className="input flex-1 text-xs" value={reportEmail}
                        onChange={e => setReportEmail(e.target.value)}
                        placeholder="Send report to email..." />
                      <button onClick={emailReport} disabled={!reportEmail || sendingReport}
                        className="text-xs px-4 py-2 bg-accent text-white rounded-xl hover:bg-accent/90 disabled:opacity-50 font-medium">
                        {sendingReport ? '...' : '✉ Send'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-ink-400 text-center py-8">No data available for this campaign</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── EDIT MODAL ── */}
      {editingAd && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setEditingAd(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="card p-6 w-full max-w-2xl space-y-4 my-8">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink-900">✏ Edit Campaign</p>
                <button onClick={() => setEditingAd(null)} className="text-xs text-ink-400 hover:text-ink-600">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="label">Campaign Name</label><input className="input" value={editForm.campaign_name} onChange={e => setEditForm((f: any) => ({ ...f, campaign_name: e.target.value }))} /></div>
                <div><label className="label">Headline</label><input className="input" value={editForm.headline || ''} onChange={e => setEditForm((f: any) => ({ ...f, headline: e.target.value }))} /></div>
                <div><label className="label">CTA Text</label><input className="input" value={editForm.cta_text || ''} onChange={e => setEditForm((f: any) => ({ ...f, cta_text: e.target.value }))} /></div>
                <div className="col-span-2"><label className="label">Destination URL</label><input className="input" value={editForm.destination_url || ''} onChange={e => setEditForm((f: any) => ({ ...f, destination_url: e.target.value }))} /></div>
                <div><label className="label">Start Date</label><input type="date" className="input" value={editForm.start_date || ''} onChange={e => setEditForm((f: any) => ({ ...f, start_date: e.target.value }))} /></div>
                <div><label className="label">End Date</label><input type="date" className="input" value={editForm.end_date || ''} onChange={e => setEditForm((f: any) => ({ ...f, end_date: e.target.value }))} /></div>
                <div><label className="label">CPM Rate (₹)</label><input type="number" className="input" value={editForm.cpm_rate_inr || 0} onChange={e => setEditForm((f: any) => ({ ...f, cpm_rate_inr: parseFloat(e.target.value) || 0 }))} /></div>
                <div><label className="label">Priority (0-100)</label><input type="number" className="input" min={0} max={100} value={editForm.priority || 0} onChange={e => setEditForm((f: any) => ({ ...f, priority: parseInt(e.target.value) || 0 }))} /></div>

                {/* Site targeting — collapsible in edit modal */}
                <div className="col-span-2 border border-ink-200 rounded-xl overflow-hidden">
                  <button onClick={() => setEditCollapsePublishers(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-ink-50 hover:bg-ink-100 transition-colors">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-ink-700">🌐 Target Sites</p>
                      {(editForm.target_site_urls || []).length > 0 && (
                        <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{editForm.target_site_urls.length} selected</span>
                      )}
                    </div>
                    <span className="text-ink-400 text-xs">{editCollapsePublishers ? '▼ Show' : '▲ Hide'}</span>
                  </button>
                  {!editCollapsePublishers && (
                    <div className="p-3 space-y-2">
                      {publisherSites.map(site => {
                        const selected = (editForm.target_site_urls || []).includes(site.domain)
                        return (
                          <button key={site.domain} onClick={() => setEditForm((f: any) => ({
                            ...f,
                            target_site_urls: selected
                              ? (f.target_site_urls || []).filter((x: string) => x !== site.domain)
                              : [...(f.target_site_urls || []), site.domain]
                          }))}
                            className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl border transition-all ${selected ? 'border-violet-400 bg-violet-50' : 'border-ink-200 hover:border-ink-300'}`}>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ? 'bg-violet-600 border-violet-600' : 'border-ink-300'}`}>
                              {selected && <span className="text-white text-[10px]">✓</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-ink-900">{site.name}</p>
                              <p className="text-xs text-ink-400">{site.domain}</p>
                            </div>
                          </button>
                        )
                      })}
                      {publisherSites.length === 0 && <p className="text-xs text-ink-400">No publishers yet</p>}
                    </div>
                  )}
                  {(editForm.target_site_urls || []).length > 0 && editCollapsePublishers && (
                    <div className="px-4 py-2 border-t border-ink-100">
                      <p className="text-xs text-violet-600">✓ {editForm.target_site_urls.join(', ')}</p>
                    </div>
                  )}
                </div>

                {/* Gender */}
                <div className="col-span-2">
                  <label className="label">Gender</label>
                  <div className="flex gap-2">
                    {[{ k: 'all', l: 'All' }, { k: 'male', l: 'Male' }, { k: 'female', l: 'Female' }, { k: 'other', l: 'Other' }].map(g => (
                      <button key={g.k} onClick={() => setEditForm((f: any) => ({ ...f, target_gender: g.k }))}
                        className={`text-xs px-4 py-2 rounded-xl border ${editForm.target_gender === g.k ? 'border-accent bg-accent/5 text-accent font-semibold' : 'border-ink-200 text-ink-600'}`}>
                        {g.l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Geo */}
                <div className="col-span-2 border border-ink-200 rounded-xl overflow-hidden">
                  <button onClick={() => setEditCollapseCountries(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-ink-50 hover:bg-ink-100 transition-colors">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-ink-700">🌍 Countries / States / Cities</p>
                      {((editForm.target_countries || []).length + (editForm.target_states || []).length + (editForm.target_cities || []).length) > 0 && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {(editForm.target_countries || []).length + (editForm.target_states || []).length + (editForm.target_cities || []).length} selected
                        </span>
                      )}
                    </div>
                    <span className="text-ink-400 text-xs">{editCollapseCountries ? '▼ Show' : '▲ Hide'}</span>
                  </button>
                  {!editCollapseCountries && (
                    <div className="p-3 space-y-3">
                      <div>
                        <p className="text-xs font-medium text-ink-600 mb-1">Countries</p>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {geoData.countries.length === 0 ? (
                            <p className="text-xs text-ink-400">No audience geo data yet</p>
                          ) : geoData.countries.map(c => (
                            <button key={c} onClick={() => setEditForm((f: any) => ({ ...f, target_countries: f.target_countries?.includes(c) ? f.target_countries.filter((x: string) => x !== c) : [...(f.target_countries || []), c] }))}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${(editForm.target_countries || []).includes(c) ? 'bg-blue-600 text-white border-transparent' : 'bg-white text-ink-600 border-ink-200'}`}>
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-ink-600 mb-1">States</p>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {geoData.states.map(s => (
                            <button key={s} onClick={() => setEditForm((f: any) => ({ ...f, target_states: f.target_states?.includes(s) ? f.target_states.filter((x: string) => x !== s) : [...(f.target_states || []), s] }))}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${(editForm.target_states || []).includes(s) ? 'bg-violet-600 text-white border-transparent' : 'bg-white text-ink-600 border-ink-200'}`}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-ink-600 mb-1">Cities</p>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {geoData.cities.map(c => (
                            <button key={c} onClick={() => setEditForm((f: any) => ({ ...f, target_cities: f.target_cities?.includes(c) ? f.target_cities.filter((x: string) => x !== c) : [...(f.target_cities || []), c] }))}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${(editForm.target_cities || []).includes(c) ? 'bg-green-600 text-white border-transparent' : 'bg-white text-ink-600 border-ink-200'}`}>
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="col-span-2"><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={editForm.campaign_notes || ''} onChange={e => setEditForm((f: any) => ({ ...f, campaign_notes: e.target.value }))} /></div>
              </div>
              <div className="flex gap-3">
                <button onClick={updateAd} disabled={savingEdit} className="flex-1 btn-primary disabled:opacity-50">
                  {savingEdit ? 'Saving...' : '✓ Save Changes'}
                </button>
                <button onClick={() => setEditingAd(null)} className="px-4 py-2 text-sm bg-ink-100 text-ink-600 rounded-xl">Cancel</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
