'use client'
// components/admin/MonetizationPanel.tsx — v2
// v2: Site / Network / Device on ad units, Network vs Direct vs GAM type,
//     full IAB size list, save warnings, "assign now?" prompt, clear errors.
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { PublisherAdAssignment } from '@/components/admin/PublisherAdAssignment'
interface AdUnit {
  id: string; name: string; ad_type: string; position: string
  ad_code: string; gam_network_code?: string; gam_unit_path?: string
  size_width: number; size_height: number; is_active: boolean
  network_name?: string; site_url?: string; device?: string
}
interface AdsTxtEntry {
  id: string; domain: string; publisher_id: string; relationship: string
  certification_authority_id?: string; notes?: string
}
interface RevenueReport {
  report_date: string; impressions: number; clicks: number
  revenue_usd: number; publisher_earnings_usd: number; platform_earnings_usd: number
  sites?: { name: string }; ad_units?: { name: string; position: string }
}
interface RevenueStats {
  totalRevenue: number; totalImpressions: number; totalClicks: number
  publisherEarnings: number; platformEarnings: number
}
const POSITIONS = [
  { v: 'header', label: 'Header (top of article)' },
  { v: 'in_content', label: 'In content (after paragraph)' },
  { v: 'footer', label: 'Footer (320x50 = sticky bar)' },
  { v: 'sidebar', label: 'Sidebar' },
]
const SIZES = [
  { label: 'Leaderboard 728×90', w: 728, h: 90 },
  { label: 'Super Leaderboard 970×90', w: 970, h: 90 },
  { label: 'Billboard 970×250', w: 970, h: 250 },
  { label: 'Banner 468×60', w: 468, h: 60 },
  { label: 'Medium Rectangle 300×250', w: 300, h: 250 },
  { label: 'Large Rectangle 336×280', w: 336, h: 280 },
  { label: 'Square 250×250', w: 250, h: 250 },
  { label: 'Half Page 300×600', w: 300, h: 600 },
  { label: 'Wide Skyscraper 160×600', w: 160, h: 600 },
  { label: 'Mobile Banner 320×50', w: 320, h: 50 },
  { label: 'Large Mobile Banner 320×100', w: 320, h: 100 },
  { label: 'Mobile Interstitial 320×480', w: 320, h: 480 },
]
const DEVICES = [
  { v: 'all', label: 'All devices' },
  { v: 'mobile', label: 'Mobile only' },
  { v: 'desktop', label: 'Desktop only' },
]
const TYPES = [
  { v: 'network', label: 'Network tag (partner code)' },
  { v: 'direct', label: 'Direct (sold campaign code)' },
  { v: 'gam', label: 'Google Ad Manager (GAM)' },
]
const deviceLabel = (d?: string) => DEVICES.find(x => x.v === (d || 'all'))?.label || 'All devices'
const typeBadge = (t: string) =>
  t === 'gam' ? 'bg-blue-100 text-blue-700' : t === 'network' ? 'bg-violet-100 text-violet-700' : 'bg-green-100 text-green-700'

const blankAdForm = () => ({
  name: '', ad_type: 'network', position: 'in_content', ad_code: '', gam_network_code: '', gam_unit_path: '',
  size_width: 300, size_height: 250, site_url: '', network_name: '', device: 'all',
})

// Keep device sensible when size changes: wide units default to desktop
function withSize(form: any, w: number, h: number) {
  const next = { ...form, size_width: w, size_height: h }
  if (w >= 468 && (form.device || 'all') === 'all') next.device = 'desktop'
  if (w < 468 && form.device === 'desktop' && form.size_width >= 468) next.device = 'all'
  return next
}

function SizeSelect({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  const idx = SIZES.findIndex(s => s.w === form.size_width && s.h === form.size_height)
  return (
    <select className="input" value={idx >= 0 ? String(idx) : 'custom'} onChange={e => {
      if (e.target.value === 'custom') return
      const s = SIZES[parseInt(e.target.value, 10)]
      setForm(withSize(form, s.w, s.h))
    }}>
      {idx < 0 && <option value="custom">Custom {form.size_width}×{form.size_height}</option>}
      {SIZES.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
    </select>
  )
}

export function MonetizationPanel({ isAdmin = false }: { isAdmin?: boolean }) {
  const [tab, setTab] = useState<string>('ad_units')
  // Ad units state
  const [adUnits, setAdUnits] = useState<AdUnit[]>([])
  const [showAdForm, setShowAdForm] = useState(false)
  const [editUnit, setEditUnit] = useState<AdUnit | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [adForm, setAdForm] = useState<any>(blankAdForm())
  const [saving, setSaving] = useState(false)
  // Ads.txt state
  const [adsTxt, setAdsTxt] = useState<AdsTxtEntry[]>([])
  const [showTxtForm, setShowTxtForm] = useState(false)
  const [txtForm, setTxtForm] = useState({ domain: '', publisher_id: '', relationship: 'DIRECT', certification_authority_id: '', notes: '' })
  const [pushing, setPushing] = useState(false)
  // Revenue state
  const [revenue, setRevenue] = useState<{ reports: RevenueReport[]; stats: RevenueStats; ctr: number; ecpm: number } | null>(null)
  const [period, setPeriod] = useState('30')
  const [showRevenueForm, setShowRevenueForm] = useState(false)
  const [revForm, setRevForm] = useState({ publisher_id: '', report_date: new Date().toISOString().split('T')[0], impressions: '', clicks: '', revenue_usd: '', revenue_share_pct: '70', network: 'GAM' })
  useEffect(() => { fetchAdUnits(); fetchAdsTxt(); fetchRevenue() }, [])
  useEffect(() => { fetchRevenue() }, [period])

  // suggestions for Site / Network inputs, from existing units
  const knownSites = Array.from(new Set(adUnits.map(u => (u.site_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '')).filter(Boolean))).sort()
  const knownNetworks = Array.from(new Set(['direct', ...adUnits.map(u => (u.network_name || '').toLowerCase()).filter(Boolean)])).sort()

  async function fetchAdUnits() {
    const res = await fetch('/api/monetization/ad-units')
    if (res.ok) setAdUnits(await res.json())
  }
  async function fetchAdsTxt() {
    const res = await fetch('/api/monetization/ads-txt')
    if (res.ok) setAdsTxt(await res.json())
  }
  async function fetchRevenue() {
    const res = await fetch(`/api/monetization/revenue?period=${period}`)
    if (res.ok) setRevenue(await res.json())
  }

  function showWarnings(data: any) {
    for (const w of data?.warnings || []) toast(w, { icon: '⚠️', duration: 7000 })
  }

  async function createAdUnit() {
    if (!adForm.name.trim()) return toast.error('Name is required')
    if (!adForm.site_url.trim()) return toast.error('Choose the site this unit belongs to')
    if (!adForm.network_name.trim()) return toast.error('Choose the network (or "direct")')
    if (!adForm.ad_code.trim() && adForm.ad_type !== 'gam') return toast.error('Paste the ad code')
    setSaving(true)
    try {
      const res = await fetch('/api/monetization/ad-units', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(adForm)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || 'Failed to create ad unit'); return }
      toast.success(`Ad unit "${data.name}" created`)
      showWarnings(data)
      setShowAdForm(false)
      setAdForm(blankAdForm())
      await fetchAdUnits()
      if (confirm(`"${data.name}" is created but not on any site yet.\n\nAssign it to a publisher now?`)) {
        setTab('assign')
        toast(`Pick "${data.name}" in the Ad Unit list and set the paragraph + revenue share.`, { icon: '👉', duration: 6000 })
      }
    } finally { setSaving(false) }
  }
  function openEditUnit(unit: AdUnit) {
    setEditUnit(unit)
    setEditForm({
      name: unit.name || '', ad_type: unit.ad_type || 'network',
      position: unit.position || 'in_content', ad_code: unit.ad_code || '',
      gam_network_code: unit.gam_network_code || '', gam_unit_path: unit.gam_unit_path || '',
      size_width: unit.size_width || 300, size_height: unit.size_height || 250,
      network_name: unit.network_name || '', site_url: (unit.site_url || '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
      device: unit.device || 'all',
      is_active: unit.is_active !== false,
    })
  }
  async function updateAdUnit() {
    if (!editUnit) return
    setSaving(true)
    try {
      const res = await fetch('/api/monetization/ad-units', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editUnit.id, ...editForm }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || 'Failed to update'); return }
      toast.success('Ad unit updated')
      showWarnings(data)
      setEditUnit(null)
      fetchAdUnits()
    } finally { setSaving(false) }
  }
  async function deleteAdUnit(id: string) {
    if (!confirm('Delete this ad unit?')) return
    const res = await fetch('/api/monetization/ad-units', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { toast.error(data.error || 'Delete failed'); return }
    toast.success('Deleted'); fetchAdUnits()
  }
  async function addAdsTxt() {
    const res = await fetch('/api/monetization/ads-txt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(txtForm)
    })
    if (res.ok) { toast.success('Entry added'); setShowTxtForm(false); fetchAdsTxt(); setTxtForm({ domain: '', publisher_id: '', relationship: 'DIRECT', certification_authority_id: '', notes: '' }) }
    else toast.error('Failed to add entry')
  }
  async function pushAdsTxt() {
    setPushing(true)
    const res = await fetch('/api/monetization/ads-txt/push', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
    })
    const data = await res.json()
    toast.success(`Pushed to ${data.successful}/${data.total_sites} sites`)
    setPushing(false)
  }
  async function addRevenue() {
    const res = await fetch('/api/monetization/revenue', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...revForm, impressions: parseInt(revForm.impressions), clicks: parseInt(revForm.clicks), revenue_usd: parseFloat(revForm.revenue_usd), revenue_share_pct: parseInt(revForm.revenue_share_pct) })
    })
    if (res.ok) { toast.success('Revenue report added'); setShowRevenueForm(false); fetchRevenue() }
    else toast.error('Failed to add report')
  }
  const tabs = isAdmin ? [
    { key: 'ad_units', label: '📢 Ad Units' },
    { key: 'assign', label: '🎯 Assign to Publishers' },
    { key: 'ads_txt', label: '📄 ads.txt' },
    { key: 'revenue', label: '💰 Revenue' },
  ] : [] as { key: string; label: string }[]

  // Shared unit fields for Create + Edit
  const unitFields = (form: any, setForm: (f: any) => void) => (
    <>
      <div>
        <label className="label">Type</label>
        <select className="input" value={form.ad_type} onChange={e => setForm({ ...form, ad_type: e.target.value, network_name: e.target.value === 'direct' && !form.network_name ? 'direct' : form.network_name })}>
          {TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Site</label>
        <input className="input" list="tv-known-sites" value={form.site_url} onChange={e => setForm({ ...form, site_url: e.target.value })} placeholder="kannadadunia.com" />
      </div>
      <div>
        <label className="label">Network / partner</label>
        <input className="input" list="tv-known-networks" value={form.network_name} onChange={e => setForm({ ...form, network_name: e.target.value })} placeholder="adsterra / adsense / direct" />
      </div>
      <div>
        <label className="label">Position</label>
        <select className="input" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}>
          {POSITIONS.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}
          {!POSITIONS.some(p => p.v === form.position) && <option value={form.position}>{form.position}</option>}
        </select>
      </div>
      <div>
        <label className="label">Size</label>
        <SizeSelect form={form} setForm={setForm} />
      </div>
      <div>
        <label className="label">Device</label>
        <select className="input" value={form.device || 'all'} onChange={e => setForm({ ...form, device: e.target.value })}>
          {DEVICES.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
        </select>
        {form.device === 'mobile' && form.size_width >= 468 && <p className="text-xs text-amber-600 mt-1">{form.size_width}px is wider than most phones.</p>}
      </div>
    </>
  )

  return (
    <div className="space-y-5">
      <datalist id="tv-known-sites">{knownSites.map(s => <option key={s} value={s} />)}</datalist>
      <datalist id="tv-known-networks">{knownNetworks.map(n => <option key={n} value={n} />)}</datalist>
      <div className="flex gap-1 p-1 bg-ink-100 rounded-xl w-fit overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${tab === t.key ? 'bg-white shadow text-ink-900' : 'text-ink-500 hover:text-ink-700'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {/* AD UNITS — admin only */}
      {tab === 'ad_units' && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-ink-900">Ad Units</h3>
              <p className="text-xs text-ink-400">Create ad slots per site and device — then assign them to publishers with custom revenue splits</p>
            </div>
            <button onClick={() => setShowAdForm(!showAdForm)} className="btn-primary btn-sm">
              + New Ad Unit
            </button>
          </div>
          {showAdForm && (
            <div className="card p-5 space-y-4 border-2 border-accent/20">
              <h4 className="font-semibold text-ink-900">Create Ad Unit</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Name</label>
                  <input className="input" value={adForm.name} onChange={e => setAdForm({ ...adForm, name: e.target.value })} placeholder="e.g. KD_InContent_300x250_P1" />
                </div>
                {unitFields(adForm, setAdForm)}
              </div>
              {adForm.ad_type === 'gam' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">GAM Network Code</label>
                    <input className="input font-mono text-xs" value={adForm.gam_network_code} onChange={e => setAdForm({ ...adForm, gam_network_code: e.target.value })} placeholder="123456789" />
                  </div>
                  <div>
                    <label className="label">GAM Ad Unit Path</label>
                    <input className="input font-mono text-xs" value={adForm.gam_unit_path} onChange={e => setAdForm({ ...adForm, gam_unit_path: e.target.value })} placeholder="/123456/unit-name" />
                  </div>
                </div>
              )}
              <div>
                <label className="label">Ad Code {adForm.ad_type === 'gam' ? '(optional override)' : '(paste full tag — one zone per unit)'}</label>
                <textarea className="input font-mono text-xs resize-none" rows={4}
                  value={adForm.ad_code} onChange={e => setAdForm({ ...adForm, ad_code: e.target.value })}
                  placeholder={adForm.ad_type === 'gam' ? '<script>/* GPT tag */</script>' : '<script ...></script>'} />
              </div>
              <div className="flex gap-3">
                <button onClick={createAdUnit} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Saving…' : 'Create Ad Unit'}</button>
                <button onClick={() => setShowAdForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {adUnits.length === 0 && <p className="text-center py-8 text-ink-300 text-sm">No ad units yet. Create your first one.</p>}
            {adUnits.map(unit => (
              <div key={unit.id} className="card p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBadge(unit.ad_type)}`}>
                    {String(unit.ad_type || 'direct').toUpperCase()}
                  </span>
                  <div>
                    <p className="font-medium text-ink-900 text-sm">{unit.name}</p>
                    <p className="text-xs text-ink-400">
                      {unit.position} · {unit.size_width}×{unit.size_height} · {deviceLabel(unit.device)}
                      {unit.network_name ? ` · ${unit.network_name}` : ''}
                      {unit.site_url ? ` · ${unit.site_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : <span className="text-amber-600"> · no site set</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${unit.is_active ? 'bg-green-500' : 'bg-ink-300'}`} />
                  <button onClick={() => openEditUnit(unit)} className="text-xs text-blue-500 hover:text-blue-600 px-2 py-1">Edit</button>
                  <button onClick={() => deleteAdUnit(unit.id)} className="text-xs text-red-500 hover:text-red-600 px-2 py-1">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* ASSIGN TO PUBLISHERS — admin only */}
      {tab === 'assign' && isAdmin && <PublisherAdAssignment />}
      {/* ADS.TXT */}
      {tab === 'ads_txt' && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-ink-900">ads.txt Manager</h3>
              <p className="text-xs text-ink-400">Manage demand partner declarations — push to all publisher sites at once</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setShowTxtForm(!showTxtForm)} className="btn-secondary btn-sm">+ Add entry</button>
              <button onClick={pushAdsTxt} disabled={pushing} className="btn-primary btn-sm">
                {pushing ? '⟳ Pushing...' : '📤 Push to all sites'}
              </button>
              <button onClick={() => {
                const lines = ['# TrendingVerse CMS ads.txt', `# Updated: ${new Date().toISOString().split('T')[0]}`, '']
                adsTxt.forEach(e => {
                  const parts = [e.domain, e.publisher_id, e.relationship]
                  if (e.certification_authority_id) parts.push(e.certification_authority_id)
                  lines.push(parts.join(', '))
                })
                const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = 'ads.txt'; a.click()
                URL.revokeObjectURL(url)
              }} className="btn-secondary btn-sm">
                ⬇ Download ads.txt
              </button>
            </div>
          </div>
          {showTxtForm && (
            <div className="card p-5 space-y-4 border-2 border-accent/20">
              <h4 className="font-semibold text-ink-900">Add ads.txt Entry</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Domain</label>
                  <input className="input font-mono text-xs" value={txtForm.domain} onChange={e => setTxtForm({ ...txtForm, domain: e.target.value })} placeholder="google.com" />
                </div>
                <div>
                  <label className="label">Publisher/Seller ID</label>
                  <input className="input font-mono text-xs" value={txtForm.publisher_id} onChange={e => setTxtForm({ ...txtForm, publisher_id: e.target.value })} placeholder="pub-1234567890" />
                </div>
                <div>
                  <label className="label">Relationship</label>
                  <select className="input" value={txtForm.relationship} onChange={e => setTxtForm({ ...txtForm, relationship: e.target.value })}>
                    <option value="DIRECT">DIRECT</option>
                    <option value="RESELLER">RESELLER</option>
                  </select>
                </div>
                <div>
                  <label className="label">Cert Authority ID (optional)</label>
                  <input className="input font-mono text-xs" value={txtForm.certification_authority_id} onChange={e => setTxtForm({ ...txtForm, certification_authority_id: e.target.value })} placeholder="f08c47fec0942fa0" />
                </div>
                <div className="col-span-2">
                  <label className="label">Notes (optional)</label>
                  <input className="input" value={txtForm.notes} onChange={e => setTxtForm({ ...txtForm, notes: e.target.value })} placeholder="Google AdSense" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={addAdsTxt} className="btn-primary">Add Entry</button>
                <button onClick={() => setShowTxtForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}
          <div className="card p-4">
            <p className="text-xs font-medium text-ink-500 mb-3">CURRENT ads.txt ({adsTxt.length} entries)</p>
            <div className="bg-ink-950 rounded-xl p-4 font-mono text-xs text-green-400 max-h-48 overflow-y-auto">
              {adsTxt.length === 0 && <span className="text-ink-500">No entries yet</span>}
              {adsTxt.map((e, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <span>{e.domain}, {e.publisher_id}, {e.relationship}{e.certification_authority_id ? `, ${e.certification_authority_id}` : ''}</span>
                  <button onClick={async () => {
                    await fetch('/api/monetization/ads-txt', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.id }) })
                    fetchAdsTxt()
                  }} className="opacity-0 group-hover:opacity-100 text-red-400 ml-4">×</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* REVENUE */}
      {tab === 'revenue' && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-ink-900">Revenue Dashboard</h3>
              <p className="text-xs text-ink-400">All publishers — earnings and splits</p>
            </div>
            <div className="flex gap-2">
              <select className="input text-sm w-32" value={period} onChange={e => setPeriod(e.target.value)}>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
              <button onClick={() => setShowRevenueForm(!showRevenueForm)} className="btn-primary btn-sm">+ Add report</button>
            </div>
          </div>
          {revenue && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Revenue', value: `$${revenue.stats.totalRevenue.toFixed(4)}`, icon: '💰', color: 'text-green-600' },
                { label: 'Publisher Earnings', value: `$${revenue.stats.publisherEarnings.toFixed(4)}`, icon: '👤', color: 'text-blue-600' },
                { label: 'Platform Earnings', value: `$${revenue.stats.platformEarnings.toFixed(4)}`, icon: '🏢', color: 'text-violet-600' },
                { label: 'eCPM', value: `$${revenue.ecpm.toFixed(3)}`, icon: '📊', color: 'text-amber-600' },
                { label: 'Impressions', value: revenue.stats.totalImpressions.toLocaleString(), icon: '👁', color: 'text-ink-900' },
                { label: 'Clicks', value: revenue.stats.totalClicks.toLocaleString(), icon: '👆', color: 'text-ink-900' },
                { label: 'CTR', value: `${revenue.ctr}%`, icon: '📈', color: revenue.ctr > 1 ? 'text-green-600' : 'text-amber-500' },
                { label: 'INR equiv', value: `₹${(revenue.stats.publisherEarnings * 83).toFixed(2)}`, icon: '₹', color: 'text-ink-900' },
              ].map(s => (
                <div key={s.label} className="card p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-ink-400">{s.label}</span>
                    <span>{s.icon}</span>
                  </div>
                  <div className={`text-xl font-display font-bold ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>
          )}
          {showRevenueForm && (
            <div className="card p-5 space-y-4 border-2 border-accent/20">
              <h4 className="font-semibold text-ink-900">Add Revenue Report</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Publisher ID</label>
                  <input className="input font-mono text-xs" value={revForm.publisher_id} onChange={e => setRevForm({ ...revForm, publisher_id: e.target.value })} placeholder="uuid" />
                </div>
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="input" value={revForm.report_date} onChange={e => setRevForm({ ...revForm, report_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">Network</label>
                  <select className="input" value={revForm.network} onChange={e => setRevForm({ ...revForm, network: e.target.value })}>
                    {['GAM', 'AdSense', 'PubMatic', 'AppNexus', 'Taboola', 'Manual'].map(n => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Impressions</label>
                  <input type="number" className="input" value={revForm.impressions} onChange={e => setRevForm({ ...revForm, impressions: e.target.value })} />
                </div>
                <div>
                  <label className="label">Clicks</label>
                  <input type="number" className="input" value={revForm.clicks} onChange={e => setRevForm({ ...revForm, clicks: e.target.value })} />
                </div>
                <div>
                  <label className="label">Revenue (USD)</label>
                  <input type="number" step="0.0001" className="input" value={revForm.revenue_usd} onChange={e => setRevForm({ ...revForm, revenue_usd: e.target.value })} />
                </div>
                <div>
                  <label className="label">Publisher share %</label>
                  <input type="number" min="0" max="100" className="input" value={revForm.revenue_share_pct} onChange={e => setRevForm({ ...revForm, revenue_share_pct: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={addRevenue} className="btn-primary">Save Report</button>
                <button onClick={() => setShowRevenueForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-ink-50 border-b border-ink-100">
                <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">Date</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Impressions</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Clicks</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Revenue</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Publisher share</th>
              </tr></thead>
              <tbody>
                {(revenue?.reports || []).length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-ink-300 text-sm">No revenue data yet. Add your first report.</td></tr>
                )}
                {(revenue?.reports || []).map((r, i) => (
                  <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                    <td className="px-4 py-3 text-xs">{r.report_date}</td>
                    <td className="px-4 py-3 text-xs text-right">{r.impressions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-right">{r.clicks.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-right font-medium text-green-600">${r.revenue_usd.toFixed(4)}</td>
                    <td className="px-4 py-3 text-xs text-right font-medium text-blue-600">${r.publisher_earnings_usd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* EDIT AD UNIT MODAL */}
      {editUnit && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setEditUnit(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="card p-6 w-full max-w-2xl space-y-4 my-8">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink-900">✏ Edit Ad Unit</p>
                <button onClick={() => setEditUnit(null)} className="text-xs text-ink-400 hover:text-ink-600">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Name</label><input className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
                {unitFields(editForm, setEditForm)}
                {editForm.ad_type === 'gam' && (
                  <>
                    <div><label className="label">GAM Network Code</label><input className="input font-mono text-xs" value={editForm.gam_network_code} onChange={e => setEditForm({ ...editForm, gam_network_code: e.target.value })} /></div>
                    <div><label className="label">GAM Unit Path</label><input className="input font-mono text-xs" value={editForm.gam_unit_path} onChange={e => setEditForm({ ...editForm, gam_unit_path: e.target.value })} /></div>
                  </>
                )}
                <div className="col-span-2"><label className="label">Ad Code</label><textarea className="input font-mono text-xs resize-none" rows={5} value={editForm.ad_code} onChange={e => setEditForm({ ...editForm, ad_code: e.target.value })} /></div>
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" checked={editForm.is_active} onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })} className="w-4 h-4 accent-accent" />
                  <label className="text-sm text-ink-700">Active</label>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={updateAdUnit} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Saving…' : '✓ Save Changes'}</button>
                <button onClick={() => setEditUnit(null)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
