'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface Publisher {
  id?: string; name: string; site: string; site_url?: string
  category: string; region: string; language: string
  monthly_audience: string; contact_email: string; contact_phone: string
  contact_name?: string; notes?: string; status?: string
  why?: string; fit_score?: number; contact_verified?: boolean; contact_source?: string
}

interface Campaign {
  id: string; name: string; brief: string; brand: string
  category: string; target_audience: string; regions: string[]
  budget_range: string; status: string; created_at: string
}

export function OutreachPanel({ isAdmin }: { isAdmin: boolean }) {
  const [tab, setTab] = useState<'campaigns' | 'publishers'>('campaigns')
  const [howItWorksOpen, setHowItWorksOpen] = useState(!isAdmin)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [publishers, setPublishers] = useState<Publisher[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null)
  const [suggestions, setSuggestions] = useState<Publisher[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [emailDraft, setEmailDraft] = useState('')
  const [draftingFor, setDraftingFor] = useState<Publisher | null>(null)
  const [draftLoading, setDraftLoading] = useState(false)
  const [sendModal, setSendModal] = useState(false)
  const [senderEmail, setSenderEmail] = useState('')
  const [senderName, setSenderName] = useState('')
  const [senderTitle, setSenderTitle] = useState('')
  const [showCampaignForm, setShowCampaignForm] = useState(false)
  const [showPubForm, setShowPubForm] = useState(false)
  const [briefInput, setBriefInput] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [pubScope, setPubScope] = useState<'both' | 'india' | 'global'>('both')
  const [pubForm, setPubForm] = useState<Partial<Publisher>>({})
  const [savingPub, setSavingPub] = useState<string | null>(null)
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null)
  const [editCampaignForm, setEditCampaignForm] = useState<any>({})
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('')
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])
  const [campaignForm, setCampaignForm] = useState({
    brand: '',
    vertical: '',
    budget: '',
    audience: '',
    formats: [] as string[],
    devices: [] as string[],
    dealType: '',
    kpi: '',
    startDate: '',
    endDate: '',
    notes: '',
  })

  const COUNTRIES = [
    { code: 'IN', label: '🇮🇳 India' },
    { code: 'US', label: '🇺🇸 United States' },
    { code: 'UK', label: '🇬🇧 United Kingdom' },
    { code: 'AE', label: '🇦🇪 UAE' },
    { code: 'SG', label: '🇸🇬 Singapore' },
    { code: 'BD', label: '🇧🇩 Bangladesh' },
    { code: 'PK', label: '🇵🇰 Pakistan' },
    { code: 'LK', label: '🇱🇰 Sri Lanka' },
    { code: 'MY', label: '🇲🇾 Malaysia' },
    { code: 'PH', label: '🇵🇭 Philippines' },
    { code: 'ID', label: '🇮🇩 Indonesia' },
    { code: 'TH', label: '🇹🇭 Thailand' },
    { code: 'VN', label: '🇻🇳 Vietnam' },
    { code: 'MX', label: '🇲🇽 Mexico' },
    { code: 'BR', label: '🇧🇷 Brazil' },
    { code: 'NG', label: '🇳🇬 Nigeria' },
    { code: 'ZA', label: '🇿🇦 South Africa' },
    { code: 'AU', label: '🇦🇺 Australia' },
    { code: 'CA', label: '🇨🇦 Canada' },
    { code: 'DE', label: '🇩🇪 Germany' },
  ]

  function toggleCountry(code: string) {
    setSelectedCountries(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [cRes, pRes] = await Promise.all([
      fetch('/api/outreach/campaigns'),
      fetch('/api/outreach/publishers'),
    ])
    if (cRes.ok) setCampaigns(await cRes.json())
    if (pRes.ok) setPublishers(await pRes.json())
    setLoading(false)
  }

  async function deleteCampaign(id: string) {
    if (!confirm("Delete this campaign?")) return
    const res = await fetch(`/api/outreach/campaigns?id=${id}`, { method: "DELETE" })
    if (res.ok) { setCampaigns(prev => prev.filter(c => c.id !== id)); toast.success("Campaign deleted") }
    else toast.error("Failed to delete")
  }

  async function reRunCampaign(c: Campaign) {
    setActiveCampaign(c)
    setSuggestions([])
    setSummary(null)
    setSuggesting(true)
    toast.loading('Finding publishers for this campaign...', { id: 'rerun' })
    // Pass campaign_summary directly so the API never re-parses the brief
    // and can never fall back to the wrong default region (India)
    const campaignSummary = {
      brand: c.brand,
      category: c.category,
      target_audience: c.target_audience,
      regions: Array.isArray(c.regions) && c.regions.length > 0 ? c.regions : [],
      budget_range: c.budget_range,
      key_message: (c as any).key_message || '',
      campaign_type: (c as any).campaign_type || '',
    }
    const res = await fetch('/api/outreach/suggest', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief: c.brief, campaign_summary: campaignSummary }),
    })
    const data = await res.json()
    toast.dismiss('rerun')
    if (data.error) { toast.error(data.error); setSuggesting(false); setActiveCampaign(null); return }
    setSummary(data.summary)
    setSuggestions(data.suggestions || [])
    toast.success(`${data.suggestions?.length || 0} publishers found!`)
    setSuggesting(false)
  }

  function parseBriefToForm(brief: string) {
    const get = (key: string) => {
      const m = brief.match(new RegExp(`^${key}:\\s*(.+)`, 'mi'))
      return m ? m[1].trim() : ''
    }
    const getList = (key: string): string[] => {
      const v = get(key)
      return v ? v.split(',').map(s => s.trim()).filter(Boolean) : []
    }
    // Parse geo back to country codes
    const geoStr = get('Geo/Regions').toLowerCase()
    const parsedCountries = COUNTRIES
      .filter(c => geoStr.includes(c.label.replace(/^.+? /, '').toLowerCase()))
      .map(c => c.code)
    // Parse timeline
    const timeline = get('Timeline')
    const [startDate, endDate] = timeline.includes(' to ') ? timeline.split(' to ').map(s => s.trim()) : [timeline, '']
    return {
      form: {
        brand: get('Brand'),
        vertical: get('Vertical'),
        budget: get('Budget'),
        audience: get('Target Audience'),
        formats: getList('Ad Formats'),
        devices: getList('Device'),
        dealType: get('Deal Type'),
        kpi: get('KPI'),
        startDate: startDate || '',
        endDate: endDate || '',
        notes: get('Additional Notes'),
      },
      countries: parsedCountries,
      campaignName: '',
    }
  }

  function openEditCampaign(c: Campaign) {
    setEditCampaign(c)
    setEditCampaignForm({ status: c.status || 'active' })
    const parsed = parseBriefToForm(c.brief || '')
    setCampaignForm({ ...parsed.form, brand: parsed.form.brand || c.brand || '', vertical: parsed.form.vertical || c.category || '' })
    setSelectedCountries(parsed.countries)
    setCampaignName(c.name || '')
    setShowCampaignForm(false) // ensure new form is hidden; edit uses modal
  }

  async function updateCampaign() {
    if (!editCampaign) return
    setSavingCampaign(true)
    // Build brief from structured form (same logic as createCampaign)
    const countryNames = selectedCountries.map(code => COUNTRIES.find(c => c.code === code)?.label.replace(/^.+? /, '') || code)
    const builtBrief = [
      `Brand: ${campaignForm.brand}`,
      campaignForm.vertical && `Vertical: ${campaignForm.vertical}`,
      countryNames.length > 0 && `Geo/Regions: ${countryNames.join(', ')}`,
      campaignForm.audience && `Target Audience: ${campaignForm.audience}`,
      campaignForm.formats.length > 0 && `Ad Formats: ${campaignForm.formats.join(', ')}`,
      campaignForm.devices.length > 0 && `Device: ${campaignForm.devices.join(', ')}`,
      campaignForm.dealType && `Deal Type: ${campaignForm.dealType}`,
      campaignForm.kpi && `KPI: ${campaignForm.kpi}`,
      campaignForm.budget && `Budget: ${campaignForm.budget}`,
      (campaignForm.startDate || campaignForm.endDate) && `Timeline: ${[campaignForm.startDate, campaignForm.endDate].filter(Boolean).join(' to ')}`,
      campaignForm.notes && `Additional Notes: ${campaignForm.notes}`,
    ].filter(Boolean).join('\n')

    const countryNamesForRegions = selectedCountries.map(code => COUNTRIES.find(c => c.code === code)?.label.replace(/^.+? /, '') || code)
    const payload = {
      id: editCampaign.id,
      name: campaignName || editCampaign.name,
      brand: campaignForm.brand,
      category: campaignForm.vertical,
      target_audience: campaignForm.audience,
      budget_range: campaignForm.budget,
      brief: builtBrief,
      regions: countryNamesForRegions,
      status: editCampaignForm.status || 'active',
    }
    const res = await fetch('/api/outreach/campaigns', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      toast.success('Campaign updated!')
      setCampaigns(prev => prev.map(c => c.id === editCampaign.id ? { ...c, ...payload } : c))
      setEditCampaign(null)
    } else toast.error('Failed to update')
    setSavingCampaign(false)
  }

  async function createCampaign() {
    if (!campaignForm.brand.trim()) { toast.error('Enter a brand name'); return }
    setSuggesting(true)
    toast.loading('Finding best publishers...', { id: 'suggest' })

    // Build structured brief from form fields
    const countryNames = selectedCountries.map(code => COUNTRIES.find(c => c.code === code)?.label.replace(/^.+? /, '') || code)
    const builtBrief = [
      `Brand: ${campaignForm.brand}`,
      campaignForm.vertical && `Vertical: ${campaignForm.vertical}`,
      countryNames.length > 0 && `Geo/Regions: ${countryNames.join(', ')}`,
      campaignForm.audience && `Target Audience: ${campaignForm.audience}`,
      campaignForm.formats.length > 0 && `Ad Formats: ${campaignForm.formats.join(', ')}`,
      campaignForm.devices.length > 0 && `Device: ${campaignForm.devices.join(', ')}`,
      campaignForm.dealType && `Deal Type: ${campaignForm.dealType}`,
      campaignForm.kpi && `KPI: ${campaignForm.kpi}`,
      campaignForm.budget && `Budget: ${campaignForm.budget}`,
      (campaignForm.startDate || campaignForm.endDate) && `Timeline: ${[campaignForm.startDate, campaignForm.endDate].filter(Boolean).join(' to ')}`,
      campaignForm.notes && `Additional Notes: ${campaignForm.notes}`,
    ].filter(Boolean).join('\n')

    const briefWithGeo = builtBrief

    const suggestRes = await fetch('/api/outreach/suggest', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief: briefWithGeo }),
    })
    const data = await suggestRes.json()
    toast.dismiss('suggest')

    if (data.error) { toast.error(data.error); setSuggesting(false); return }

    const saveRes = await fetch('/api/outreach/campaigns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: campaignName || (data.summary?.brand || campaignForm.brand || 'Campaign') + ' — Outreach',
        brief: briefWithGeo,
        brand: data.summary?.brand,
        category: data.summary?.category,
        target_audience: data.summary?.target_audience,
        regions: data.summary?.regions,
        budget_range: data.summary?.budget_range,
        campaign_type: data.summary?.campaign_type,
        key_message: data.summary?.key_message,
      }),
    })
    const saved = await saveRes.json()
    setActiveCampaign(saved)
    setSummary(data.summary)
    setSuggestions(data.suggestions || [])
    setShowCampaignForm(false)
    setBriefInput('')
    setCampaignName('')
    setSelectedCountries([])
    setCampaignForm({ brand: '', vertical: '', budget: '', audience: '', formats: [], devices: [], dealType: '', kpi: '', startDate: '', endDate: '', notes: '' })
    setCampaigns(prev => [saved, ...prev])
    toast.success(`${data.suggestions?.length || 0} publishers matched!`)
    setSuggesting(false)
  }

  // ── FIXED: always builds campaign_summary from the campaign that's
  // actually relevant to this draft — never reuses a stale `summary`
  // left over from a different campaign's "Find Publishers" run.
  async function draftEmail(pub: Publisher, campaignOverride?: Campaign) {
    setDraftingFor(pub)
    setDraftLoading(true)
    setEmailDraft('')
    setSendModal(false)

    // Determine which campaign this draft is actually for:
    // 1. Explicit override (e.g. passed in directly)
    // 2. The campaign currently active in the Campaigns tab suggestions view
    // 3. The campaign chosen in the dropdown on the Publishers tab
    // 4. Fallback to the most recent campaign
    const sourceC =
      campaignOverride ||
      activeCampaign ||
      campaigns.find(c => c.id === selectedCampaignId) ||
      campaigns[0]

    // Only trust the AI-parsed `summary` state if it was generated for
    // THIS specific campaign (i.e. we're actively viewing its suggestions).
    // Otherwise always rebuild from the saved campaign record — this is
    // what prevents drafting an email with a different campaign's details.
    const summaryMatchesSource = !!activeCampaign && !campaignOverride && activeCampaign.id === sourceC?.id

    const campaignSummary = summaryMatchesSource && summary
      ? { ...summary, brief: sourceC?.brief || summary.brief }
      : sourceC
        ? {
            brand: sourceC.brand,
            category: sourceC.category,
            target_audience: sourceC.target_audience,
            regions: sourceC.regions,
            budget_range: sourceC.budget_range,
            key_message: (sourceC as any).key_message || '',
            campaign_type: (sourceC as any).campaign_type || '',
            brief: sourceC.brief,
          }
        : null

    const res = await fetch('/api/outreach/draft-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publisher: pub,
        campaign_summary: campaignSummary,
        sender_name: senderName,
        sender_title: senderTitle,
      }),
    })
    const data = await res.json()
    if (data.error) { toast.error('Email draft failed'); setDraftLoading(false); return }
    setEmailDraft(data.draft || '')
    setDraftLoading(false)
  }

  async function savePublisher(pub: Publisher) {
    const key = pub.name
    setSavingPub(key)
    const res = await fetch('/api/outreach/publishers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: pub.name,
        site_url: pub.site || pub.site_url || '',
        category: pub.category || '',
        region: pub.region || '',
        language: pub.language || '',
        monthly_audience: pub.monthly_audience || '',
        contact_email: pub.contact_email || '',
        contact_phone: pub.contact_phone || '',
        status: 'prospect',
      }),
    })
    if (res.ok) {
      const saved = await res.json()
      setPublishers(prev => [saved, ...prev])
      toast.success(`${pub.name} saved!`)
    } else {
      const err = await res.json()
      toast.error(err.error || 'Save failed')
    }
    setSavingPub(null)
  }

  async function updateStatus(id: string, status: string) {
    await fetch('/api/outreach/publishers', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    setPublishers(prev => prev.map(p => p.id === id ? { ...p, status } : p))
  }

  function downloadCSV(pubs: Publisher[]) {
    const headers = ['Publisher Name','Website','Category','Region','Language','Monthly Audience','Contact Email','Contact Verified','Phone','Fit Score','Why','Status']
    const rows = pubs.map(p => [
      p.name, p.site || p.site_url || '', p.category, p.region, p.language,
      p.monthly_audience, p.contact_email, p.contact_verified ? 'Yes' : 'No — confirm before use',
      p.contact_phone, p.fit_score ? p.fit_score + '%' : '—', p.why || '', p.status || 'prospect',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Outreach-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  function sendGmail() {
    if (!senderEmail || !emailDraft || !draftingFor) return
    const lines = emailDraft.split('\n')
    const subjectLine = lines.find(l => l.startsWith('Subject:'))?.replace('Subject:', '').trim() || 'Partnership Opportunity'
    const body = lines.slice(lines.findIndex(l => l.startsWith('Subject:')) + 2).join('\n')
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(draftingFor.contact_email)}&su=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`
    window.open(url, '_blank')
    setSendModal(false)
    if (draftingFor.id) updateStatus(draftingFor.id, 'contacted')
    toast.success('Gmail opened — review and send!')
  }

  const fitColor = (score = 75) => score >= 90 ? 'text-green-600' : score >= 75 ? 'text-amber-600' : 'text-red-500'
  const alreadySaved = (pub: Publisher) => publishers.some(p => p.name === pub.name || (p.site_url || p.site) === (pub.site || pub.site_url))

  if (loading) return <div className="h-24 bg-ink-50 rounded-xl animate-pulse" />

  const HOW_IT_WORKS = [
    {
      icon: '📋',
      title: 'Create a campaign brief',
      desc: 'Fill in your brand, target audience, geo, formats, budget, and KPIs. The more detail you provide, the better your publisher matches will be.',
    },
    {
      icon: '🤖',
      title: 'AI matches publishers',
      desc: 'Our AI scans the TrendingVerse publisher network and ranks sites by audience fit, category alignment, and reach — giving each a fit score.',
    },
    {
      icon: '💾',
      title: 'Save the best matches',
      desc: 'Review the ranked list of publishers. Save the ones you want to pursue — they\'ll be added to your Publisher DB for tracking.',
    },
    {
      icon: '✉',
      title: 'Draft outreach emails',
      desc: 'Click "Draft Email" on any publisher. AI writes a personalised pitch referencing their site and your campaign. Edit it, then open Gmail to send.',
    },
    {
      icon: '📊',
      title: 'Track & follow up',
      desc: 'Update each publisher\'s status (contacted → responded → onboarded). Export your list as CSV anytime to share with your team.',
    },
  ]

  return (
    <div className="space-y-5">

      {/* How it works */}
      <div className="card border border-ink-100 overflow-hidden">
        <button
          onClick={() => setHowItWorksOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-ink-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">💡</span>
            <span className="text-sm font-semibold text-ink-900">How Publisher Outreach works</span>
            {!howItWorksOpen && (
              <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">5 steps</span>
            )}
          </div>
          <span className="text-ink-400 text-xs">{howItWorksOpen ? '▲ Hide' : '▼ Show'}</span>
        </button>

        {howItWorksOpen && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mt-1">
              {HOW_IT_WORKS.map((step, i) => (
                <div key={i} className="relative">
                  {/* connector line between steps */}
                  {i < HOW_IT_WORKS.length - 1 && (
                    <div className="hidden sm:block absolute top-5 left-full w-full h-px bg-ink-100 z-0" style={{ width: 'calc(100% - 2rem)', left: '50%' }} />
                  )}
                  <div className="relative z-10 flex flex-col items-center text-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-ink-50 border-2 border-ink-100 flex items-center justify-center text-lg shrink-0">
                      {step.icon}
                    </div>
                    <div className="w-5 h-5 -mt-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center -translate-y-2">
                      {i + 1}
                    </div>
                    <p className="text-xs font-semibold text-ink-900 leading-tight -mt-2">{step.title}</p>
                    <p className="text-[11px] text-ink-500 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {!isAdmin && (
              <div className="mt-4 pt-3 border-t border-ink-100 flex items-start gap-2.5 bg-blue-50 rounded-xl px-3 py-2.5">
                <span className="text-base shrink-0">ℹ️</span>
                <p className="text-xs text-blue-700 leading-relaxed">
                  <strong>As an advertiser</strong>, you control the campaign brief and publisher targets. Our team reviews selected publishers and facilitates the deal — you'll be notified once a publisher confirms placement.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 p-1 bg-ink-100 rounded-xl">
          {[
            { key: 'campaigns', label: `📋 Campaigns (${campaigns.length})` },
            { key: 'publishers', label: `🏢 Publisher DB (${publishers.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${tab === t.key ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {tab === 'campaigns' && !activeCampaign && (
            <button onClick={() => setShowCampaignForm(true)} className="btn-primary text-xs px-4 py-2">+ New Campaign</button>
          )}
          {tab === 'campaigns' && activeCampaign && (
            <button onClick={() => { setActiveCampaign(null); setSuggestions([]); setSummary(null) }}
              className="text-xs px-4 py-2 bg-ink-100 text-ink-600 rounded-xl hover:bg-ink-200">← All Campaigns</button>
          )}
          {tab === 'publishers' && (
            <>
              <button onClick={() => downloadCSV(publishers)} disabled={!publishers.length}
                className="text-xs px-3 py-2 bg-ink-100 text-ink-700 rounded-xl hover:bg-ink-200 disabled:opacity-40">
                ⬇ Export CSV
              </button>
              <button onClick={() => setShowPubForm(true)} className="btn-primary text-xs px-4 py-2">+ Add Publisher</button>
            </>
          )}
        </div>
      </div>

      {/* ── CAMPAIGNS ── */}
      {tab === 'campaigns' && (
        <div className="space-y-4">

          {/* Campaign form */}
          {showCampaignForm && (
            <div className="card p-5 space-y-5 border-2 border-accent/20">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-ink-900">New Campaign</h3>
                <button onClick={() => setShowCampaignForm(false)} className="text-ink-400 hover:text-ink-700 text-lg leading-none">×</button>
              </div>

              {/* Row 1: Brand + Campaign Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Brand *</label>
                  <input className="input" value={campaignForm.brand} onChange={e => setCampaignForm(f => ({ ...f, brand: e.target.value }))} placeholder="e.g. Nykaa" />
                </div>
                <div>
                  <label className="label">Campaign Name <span className="text-ink-400 font-normal">(optional)</span></label>
                  <input className="input" value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. Diwali Sale 2026" />
                </div>
              </div>

              {/* Row 2: Vertical + Audience */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Vertical / Category</label>
                  <select className="input" value={campaignForm.vertical} onChange={e => setCampaignForm(f => ({ ...f, vertical: e.target.value }))}>
                    <option value="">Select vertical…</option>
                    {['E-Commerce','BFSI','Auto','FMCG','OTT / Entertainment','Ed-Tech','Gaming','Travel','Health & Pharma','Real Estate','Fashion & Lifestyle','Food & Beverage','Technology','Telecom','Sports'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Target Audience</label>
                  <input className="input" value={campaignForm.audience} onChange={e => setCampaignForm(f => ({ ...f, audience: e.target.value }))} placeholder="e.g. Males 25–44, urban, SEC A/B" />
                </div>
              </div>

              {/* Target Countries */}
              <div>
                <label className="label">Target Countries</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {COUNTRIES.map(c => (
                    <button key={c.code} type="button" onClick={() => toggleCountry(c.code)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        selectedCountries.includes(c.code)
                          ? 'bg-accent text-white border-accent font-semibold'
                          : 'border-ink-200 text-ink-600 hover:border-accent hover:text-accent'
                      }`}>
                      {c.label}
                    </button>
                  ))}
                </div>
                {selectedCountries.length > 0 && (
                  <p className="text-xs text-accent mt-1.5">
                    ✓ {selectedCountries.length} countr{selectedCountries.length > 1 ? 'ies' : 'y'} selected
                    <button onClick={() => setSelectedCountries([])} className="ml-2 text-ink-400 hover:text-red-500 underline">Clear</button>
                  </p>
                )}
              </div>

              {/* Ad Formats */}
              <div>
                <label className="label">Ad Formats</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {['Display / Banner','Native','Video (In-stream)','Video (Out-stream)','CTV','Interstitial','Rich Media','Skin / Roadblock','Sponsored Content'].map(f => (
                    <button key={f} type="button"
                      onClick={() => setCampaignForm(prev => ({ ...prev, formats: prev.formats.includes(f) ? prev.formats.filter(x => x !== f) : [...prev.formats, f] }))}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${campaignForm.formats.includes(f) ? 'bg-blue-600 text-white border-blue-600 font-semibold' : 'border-ink-200 text-ink-600 hover:border-blue-400 hover:text-blue-600'}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Device + Deal Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Device</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {['Mobile','Desktop','CTV','Tablet','All'].map(d => (
                      <button key={d} type="button"
                        onClick={() => setCampaignForm(prev => ({ ...prev, devices: prev.devices.includes(d) ? prev.devices.filter(x => x !== d) : [...prev.devices, d] }))}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${campaignForm.devices.includes(d) ? 'bg-purple-600 text-white border-purple-600 font-semibold' : 'border-ink-200 text-ink-600 hover:border-purple-400'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Deal Type</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {['Open Auction','PMP','PG','Direct','DV360','Xandr','TTD'].map(d => (
                      <button key={d} type="button"
                        onClick={() => setCampaignForm(prev => ({ ...prev, dealType: prev.dealType === d ? '' : d }))}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${campaignForm.dealType === d ? 'bg-green-600 text-white border-green-600 font-semibold' : 'border-ink-200 text-ink-600 hover:border-green-400'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* KPI + Budget */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">KPI / Goal</label>
                  <select className="input" value={campaignForm.kpi} onChange={e => setCampaignForm(f => ({ ...f, kpi: e.target.value }))}>
                    <option value="">Select KPI…</option>
                    {['Brand Awareness','CTR / Clicks','App Installs','Lead Generation','Video Views','Reach & Frequency','Sales / Conversions','Viewability'].map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Budget Range</label>
                  <input className="input" value={campaignForm.budget} onChange={e => setCampaignForm(f => ({ ...f, budget: e.target.value }))} placeholder="e.g. ₹5–10L / $10k–$50k" />
                </div>
              </div>

              {/* Timeline */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start Date</label>
                  <input type="date" className="input" value={campaignForm.startDate} onChange={e => setCampaignForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input type="date" className="input" value={campaignForm.endDate} onChange={e => setCampaignForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>

              {/* Additional Notes */}
              <div>
                <label className="label">Additional Notes <span className="text-ink-400 font-normal">(optional — any extra context)</span></label>
                <textarea className="input resize-none" rows={2} value={campaignForm.notes}
                  onChange={e => setCampaignForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Prefer premium publishers, Hindi + English content, no competitor adjacency" />
              </div>

              {/* Sender info */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-ink-100">
                <div>
                  <label className="label">Your Name <span className="text-ink-400 font-normal">(for email drafts)</span></label>
                  <input className="input" value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="e.g. Bhanushree" />
                </div>
                <div>
                  <label className="label">Your Title</label>
                  <input className="input" value={senderTitle} onChange={e => setSenderTitle(e.target.value)} placeholder="e.g. Manager – Business Development" />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={createCampaign} disabled={!campaignForm.brand.trim() || suggesting} className="btn-primary">
                  {suggesting ? '✦ Finding Publishers...' : '✦ Find Publishers'}
                </button>
                <button onClick={() => { setShowCampaignForm(false); setBriefInput('') }}
                  className="px-4 py-2 text-sm bg-ink-100 text-ink-600 rounded-xl">Cancel</button>
              </div>
            </div>
          )}

          {/* Suggestions loading */}
          {activeCampaign && suggesting && (
            <div className="card p-8 text-center">
              <p className="text-2xl mb-2 animate-pulse">✦</p>
              <p className="text-sm text-ink-500">Finding best publishers for <strong>{activeCampaign.brand || activeCampaign.name}</strong>...</p>
            </div>
          )}

          {/* Suggestions */}
          {activeCampaign && suggestions.length > 0 && !suggesting && (
            <div className="space-y-3">
              {/* Campaign summary header */}
              <div className="card p-4 border-l-4 border-accent">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-semibold text-ink-900 text-base">{activeCampaign.brand || activeCampaign.name}</p>
                    <p className="text-xs text-ink-400 mt-0.5">{activeCampaign.name && activeCampaign.name !== activeCampaign.brand ? activeCampaign.name : ''}</p>
                  </div>
                  <button onClick={() => downloadCSV(suggestions)}
                    className="text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 font-medium whitespace-nowrap shrink-0">
                    ⬇ Export CSV
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  {[
                    { l: '🏷 Brand', v: summary?.brand || activeCampaign?.brand },
                    { l: '📂 Vertical', v: summary?.category || activeCampaign?.category },
                    { l: '👥 Audience', v: summary?.target_audience || activeCampaign?.target_audience },
                    { l: '🌏 Regions', v: (summary?.regions?.length ? summary.regions : activeCampaign?.regions || []).filter(Boolean).join(', ') },
                    { l: '💰 Budget', v: summary?.budget_range || activeCampaign?.budget_range },
                    { l: '🎯 KPI', v: summary?.kpi || summary?.key_message },
                    { l: '📱 Device', v: summary?.device },
                    { l: '🔒 Deal Type', v: summary?.deal_type || summary?.campaign_type },
                  ].filter(s => s.v).map(s => (
                    <div key={s.l} className="flex gap-1.5">
                      <span className="text-ink-400 shrink-0">{s.l}:</span>
                      <span className="text-ink-700 font-medium">{s.v}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-ink-400 mt-3 pt-3 border-t border-ink-100">
                  {suggestions.length} publishers matched — save to your Publisher DB or draft an outreach email
                </p>
              </div>

              {/* Publisher cards */}
              {suggestions.map((pub, i) => {
                const saved = alreadySaved(pub)
                return (
                  <div key={i} className="card p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      {/* Rank + info */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-ink-100 text-ink-500'}`}>
                          {i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-sm font-semibold text-ink-900">{pub.name}</p>
                            <a href={pub.site?.startsWith('http') ? pub.site : `https://${pub.site}`} target="_blank" rel="noreferrer"
                              className="text-xs text-blue-500 hover:underline hover:text-blue-700">↗ {pub.site}</a>
                            {saved && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">✓ Saved to DB</span>}
                          </div>

                          <div className="flex gap-3 text-xs text-ink-500 mb-1.5">
                            {pub.region && <span>📍 {pub.region}</span>}
                            {pub.language && <span>🗣 {pub.language}</span>}
                            {pub.monthly_audience && <span>👁 {pub.monthly_audience}</span>}
                            {pub.category && <span>📂 {pub.category}</span>}
                          </div>

                          <div className="flex gap-1 flex-wrap mb-1.5">
                            {(pub as any).ctv_available && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">📺 CTV</span>}
                            {(pub as any).pmp_supported && <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-medium">🔒 PMP</span>}
                          </div>

                          {pub.why && (
                            <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-2.5 py-1.5 mb-2 border border-blue-100">
                              💡 {pub.why}
                            </p>
                          )}

                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs text-ink-600 font-mono">📧 {pub.contact_email}</span>
                            {pub.contact_phone && <span className="text-xs text-ink-500 font-mono">📞 {pub.contact_phone}</span>}
                            {pub.contact_verified ? (
                              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium" title={pub.contact_source}>✓ Verified on site</span>
                            ) : (
                              <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium" title={pub.contact_source || 'AI estimate — verify before sending'}>⚠ Unverified — confirm before use</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Score + actions */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="text-right">
                          <p className={`text-lg font-bold leading-none ${fitColor(pub.fit_score)}`}>{pub.fit_score}%</p>
                          <p className="text-[10px] text-ink-400 mt-0.5">fit score</p>
                        </div>
                        <div className="flex gap-1.5 mt-1">
                          {!saved && (
                            <button onClick={() => savePublisher(pub)} disabled={savingPub === pub.name}
                              className="text-xs px-2.5 py-1.5 bg-ink-100 text-ink-700 rounded-lg hover:bg-ink-200 disabled:opacity-50 font-medium">
                              {savingPub === pub.name ? '...' : '+ Save'}
                            </button>
                          )}
                          <button onClick={() => draftEmail(pub)}
                            className="text-xs px-3 py-1.5 bg-accent text-white rounded-lg hover:bg-accent/90 font-medium">
                            ✉ Draft Email
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Campaigns list */}
          {campaigns.length === 0 && !showCampaignForm ? (
            <div className="card p-12 text-center border-2 border-dashed border-ink-200">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-sm font-medium text-ink-700 mb-1">No campaigns yet</p>
              <p className="text-xs text-ink-400 mb-4">Create a campaign brief to find matching publishers and draft outreach emails</p>
              <button onClick={() => setShowCampaignForm(true)} className="btn-primary text-xs px-5 py-2">+ New Campaign</button>
            </div>
          ) : campaigns.length > 0 && !activeCampaign && !showCampaignForm && (
            <div className="space-y-3">
              {campaigns.map(c => {
                // Parse geo/deal/device/format from brief for display
                const getField = (key: string) => { const m = (c.brief || '').match(new RegExp(`^${key}:\\s*(.+)`, 'mi')); return m ? m[1].trim() : '' }
                const geoDisplay = getField('Geo/Regions') || (c.regions?.join(', ') || '')
                const dealDisplay = getField('Deal Type')
                const deviceDisplay = getField('Device')
                const formatDisplay = getField('Ad Formats')
                const kpiDisplay = getField('KPI')
                const statusColors: Record<string, string> = {
                  active: 'bg-green-100 text-green-700',
                  paused: 'bg-amber-100 text-amber-700',
                  closed: 'bg-ink-100 text-ink-500',
                }
                return (
                  <div key={c.id} className="card p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: campaign identity */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-semibold text-ink-900 text-sm">{c.name || `${c.brand} — Outreach`}</p>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${statusColors[c.status] || 'bg-ink-100 text-ink-500'}`}>{c.status}</span>
                          <span className="text-[10px] text-ink-400">{new Date(c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>

                        {/* Key details row */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 mb-2">
                          {c.brand && <span className="text-xs text-ink-600"><span className="text-ink-400">Brand:</span> {c.brand}</span>}
                          {c.category && <span className="text-xs text-ink-600"><span className="text-ink-400">Vertical:</span> {c.category}</span>}
                          {c.budget_range && <span className="text-xs text-ink-600"><span className="text-ink-400">Budget:</span> {c.budget_range}</span>}
                          {kpiDisplay && <span className="text-xs text-ink-600"><span className="text-ink-400">KPI:</span> {kpiDisplay}</span>}
                        </div>

                        {/* Tags row */}
                        <div className="flex flex-wrap gap-1.5">
                          {geoDisplay && geoDisplay.split(',').map(g => (
                            <span key={g} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-medium">🌏 {g.trim()}</span>
                          ))}
                          {dealDisplay && <span className="text-[10px] bg-violet-50 text-violet-700 border border-violet-100 px-2 py-0.5 rounded-full font-medium">🔒 {dealDisplay}</span>}
                          {deviceDisplay && deviceDisplay.split(',').map(d => (
                            <span key={d} className="text-[10px] bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full font-medium">📱 {d.trim()}</span>
                          ))}
                          {formatDisplay && formatDisplay.split(',').slice(0, 3).map(f => (
                            <span key={f} className="text-[10px] bg-ink-100 text-ink-600 px-2 py-0.5 rounded-full">{f.trim()}</span>
                          ))}
                          {formatDisplay && formatDisplay.split(',').length > 3 && (
                            <span className="text-[10px] text-ink-400 px-1">+{formatDisplay.split(',').length - 3} more</span>
                          )}
                        </div>

                        {c.target_audience && (
                          <p className="text-xs text-ink-400 mt-1.5">👥 {c.target_audience}</p>
                        )}
                      </div>

                      {/* Right: actions */}
                      <div className="flex flex-col gap-2 shrink-0 items-end">
                        <button onClick={() => reRunCampaign(c)}
                          className="text-xs px-3 py-1.5 bg-accent text-white rounded-lg hover:bg-accent/90 font-medium whitespace-nowrap">
                          🔍 Find Publishers
                        </button>
                        <div className="flex gap-1">
                          <button onClick={() => openEditCampaign(c)}
                            className="text-xs px-2.5 py-1.5 bg-ink-100 text-ink-600 rounded-lg hover:bg-ink-200">✏ Edit</button>
                          {isAdmin && (
                            <button onClick={() => deleteCampaign(c.id)}
                              className="text-xs px-2.5 py-1.5 text-red-500 hover:bg-red-50 rounded-lg">🗑</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PUBLISHERS DB ── */}
      {tab === 'publishers' && (
        <div className="space-y-4">
          {showPubForm && (
            <div className="card p-5 space-y-4 border-2 border-accent/20">
              <h3 className="font-semibold text-ink-900">Add Publisher</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { l: 'Publisher Name *', k: 'name', placeholder: 'DailyKannada News' },
                  { l: 'Website', k: 'site_url', placeholder: 'kannadadunia.com' },
                  { l: 'Category', k: 'category', placeholder: 'Regional News' },
                  { l: 'Region', k: 'region', placeholder: 'Karnataka' },
                  { l: 'Language', k: 'language', placeholder: 'Kannada, English' },
                  { l: 'Monthly Audience', k: 'monthly_audience', placeholder: '500K/mo' },
                  { l: 'Contact Email *', k: 'contact_email', placeholder: 'editor@site.com' },
                  { l: 'Contact Phone', k: 'contact_phone', placeholder: '+91 98765 43210' },
                  { l: 'Contact Name', k: 'contact_name', placeholder: 'Ravi Kumar' },
                ].map(f => (
                  <div key={f.k} className={f.k === 'name' || f.k === 'contact_email' ? 'col-span-2' : ''}>
                    <label className="label">{f.l}</label>
                    <input className="input" value={(pubForm as any)[f.k] || ''} placeholder={f.placeholder}
                      onChange={e => setPubForm(p => ({ ...p, [f.k]: e.target.value }))} />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="label">Notes</label>
                  <textarea className="input resize-none" rows={2} value={pubForm.notes || ''}
                    onChange={e => setPubForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={async () => {
                  if (!pubForm.name || !pubForm.contact_email) { toast.error('Name and email required'); return }
                  await savePublisher(pubForm as Publisher)
                  setShowPubForm(false); setPubForm({})
                }} className="btn-primary">Save Publisher</button>
                <button onClick={() => setShowPubForm(false)} className="px-4 py-2 text-sm bg-ink-100 text-ink-600 rounded-xl">Cancel</button>
              </div>
            </div>
          )}

          {/* Campaign selector for email drafting */}
          {campaigns.length > 0 && (
            <div className="card p-3 flex items-center gap-3">
              <p className="text-xs font-medium text-ink-600 shrink-0">📋 Campaign for email:</p>
              <select
                value={selectedCampaignId || (campaigns[0]?.id || '')}
                onChange={e => setSelectedCampaignId(e.target.value)}
                className="input text-xs flex-1 py-1.5">
                {campaigns.filter(c => c.status !== 'closed').map(c => (
                  <option key={c.id} value={c.id}>{c.brand || c.name} {c.budget_range ? `· ${c.budget_range}` : ''}</option>
                ))}
              </select>
              <p className="text-xs text-ink-400 shrink-0">Used to personalize email drafts</p>
            </div>
          )}

          {publishers.length === 0 && !showPubForm ? (
            <div className="card p-8 text-center">
              <p className="text-2xl mb-2">🏢</p>
              <p className="text-sm text-ink-500">No publishers saved yet — save from campaign suggestions or add manually</p>
            </div>
          ) : publishers.length > 0 && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-ink-50 border-b border-ink-100">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-ink-500">Publisher</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-ink-500">Contact</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Category</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Region</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Status</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Actions</th>
                </tr></thead>
                <tbody>
                  {publishers.map(pub => (
                    <tr key={pub.id} className="border-b border-ink-50 hover:bg-ink-50/50">
                      <td className="px-4 py-2.5">
                        <p className="text-xs font-medium text-ink-900">{pub.name}</p>
                        <p className="text-xs text-blue-500">{pub.site || pub.site_url}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-xs text-ink-700">{pub.contact_email}</p>
                        <p className="text-xs text-ink-400">{pub.contact_phone}</p>
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-ink-600">{pub.category}</td>
                      <td className="px-3 py-2.5 text-center text-xs text-ink-600">{pub.region}</td>
                      <td className="px-3 py-2.5 text-center">
                        <select value={pub.status || 'prospect'} onChange={e => updateStatus(pub.id!, e.target.value)}
                          className="text-xs border border-ink-200 rounded-lg px-2 py-0.5 bg-white text-ink-700">
                          {['prospect','contacted','responded','onboarded','rejected'].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => draftEmail(pub)}
                          className="text-xs px-2 py-1 bg-accent text-white rounded-lg">✉ Draft</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Email draft panel */}
      {draftingFor && (
        <div className="card p-5 border-2 border-accent/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-ink-900">✉ Outreach Email — {draftingFor.name}</p>
              <p className="text-xs text-ink-400">{draftingFor.contact_email}</p>
            </div>
            <button onClick={() => { setDraftingFor(null); setEmailDraft('') }}
              className="text-xs text-ink-400 hover:text-ink-600">✕ Close</button>
          </div>

          {/* Sender details */}
          {!emailDraft && !draftLoading && (
            <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-ink-50 rounded-xl">
              <div>
                <label className="label">Your Name (optional)</label>
                <input className="input" value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Leave blank for generic sign-off" />
              </div>
              <div>
                <label className="label">Your Title (optional)</label>
                <input className="input" value={senderTitle} onChange={e => setSenderTitle(e.target.value)} placeholder="Leave blank for generic sign-off" />
              </div>
            </div>
          )}

          {draftLoading ? (
            <div className="h-64 bg-ink-50 rounded-xl flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl mb-2 animate-pulse">✦</p>
                <p className="text-xs text-ink-400">Drafting professional outreach email...</p>
              </div>
            </div>
          ) : (
            <textarea className="input w-full resize-none font-mono text-xs leading-relaxed" rows={16}
              value={emailDraft} onChange={e => setEmailDraft(e.target.value)} />
          )}
          <div className="flex gap-2 mt-3">
            <button onClick={() => draftEmail(draftingFor)}
              className="text-xs px-3 py-2 bg-ink-100 text-ink-600 rounded-xl hover:bg-ink-200">↺ Regenerate</button>
            <button onClick={() => { navigator.clipboard.writeText(emailDraft); toast.success('Copied!') }}
              className="text-xs px-3 py-2 bg-ink-100 text-ink-600 rounded-xl hover:bg-ink-200">⎘ Copy</button>
            <button onClick={() => setSendModal(true)} disabled={draftLoading || !emailDraft}
              className="flex-1 btn-primary text-xs py-2 disabled:opacity-50">✉ Send via Gmail</button>
          </div>
        </div>
      )}

      {/* Edit Campaign Modal — full structured form */}
      {editCampaign && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setEditCampaign(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 space-y-5">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink-900">✏ Edit Campaign</p>
                <button onClick={() => setEditCampaign(null)} className="text-ink-400 hover:text-ink-700 text-lg leading-none">×</button>
              </div>

              {/* Row 1: Brand + Campaign Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Brand *</label>
                  <input className="input" value={campaignForm.brand} onChange={e => setCampaignForm(f => ({ ...f, brand: e.target.value }))} placeholder="e.g. Nykaa" />
                </div>
                <div>
                  <label className="label">Campaign Name</label>
                  <input className="input" value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. Diwali Sale 2026" />
                </div>
              </div>

              {/* Row 2: Vertical + Audience */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Vertical / Category</label>
                  <select className="input" value={campaignForm.vertical} onChange={e => setCampaignForm(f => ({ ...f, vertical: e.target.value }))}>
                    <option value="">Select vertical…</option>
                    {['E-Commerce','BFSI','Auto','FMCG','OTT / Entertainment','Ed-Tech','Gaming','Travel','Health & Pharma','Real Estate','Fashion & Lifestyle','Food & Beverage','Technology','Telecom','Sports'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Target Audience</label>
                  <input className="input" value={campaignForm.audience} onChange={e => setCampaignForm(f => ({ ...f, audience: e.target.value }))} placeholder="e.g. Males 25–44, urban, SEC A/B" />
                </div>
              </div>

              {/* Target Countries */}
              <div>
                <label className="label">Target Countries</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {COUNTRIES.map(c => (
                    <button key={c.code} type="button" onClick={() => toggleCountry(c.code)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        selectedCountries.includes(c.code)
                          ? 'bg-accent text-white border-accent font-semibold'
                          : 'border-ink-200 text-ink-600 hover:border-accent hover:text-accent'
                      }`}>
                      {c.label}
                    </button>
                  ))}
                </div>
                {selectedCountries.length > 0 && (
                  <p className="text-xs text-accent mt-1.5">
                    ✓ {selectedCountries.length} countr{selectedCountries.length > 1 ? 'ies' : 'y'} selected
                    <button onClick={() => setSelectedCountries([])} className="ml-2 text-ink-400 hover:text-red-500 underline">Clear</button>
                  </p>
                )}
              </div>

              {/* Ad Formats */}
              <div>
                <label className="label">Ad Formats</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {['Display / Banner','Native','Video (In-stream)','Video (Out-stream)','CTV','Interstitial','Rich Media','Skin / Roadblock','Sponsored Content'].map(f => (
                    <button key={f} type="button"
                      onClick={() => setCampaignForm(prev => ({ ...prev, formats: prev.formats.includes(f) ? prev.formats.filter(x => x !== f) : [...prev.formats, f] }))}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${campaignForm.formats.includes(f) ? 'bg-blue-600 text-white border-blue-600 font-semibold' : 'border-ink-200 text-ink-600 hover:border-blue-400 hover:text-blue-600'}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Device + Deal Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Device</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {['Mobile','Desktop','CTV','Tablet','All'].map(d => (
                      <button key={d} type="button"
                        onClick={() => setCampaignForm(prev => ({ ...prev, devices: prev.devices.includes(d) ? prev.devices.filter(x => x !== d) : [...prev.devices, d] }))}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${campaignForm.devices.includes(d) ? 'bg-purple-600 text-white border-purple-600 font-semibold' : 'border-ink-200 text-ink-600 hover:border-purple-400'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Deal Type</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {['Open Auction','PMP','PG','Direct','DV360','Xandr','TTD'].map(d => (
                      <button key={d} type="button"
                        onClick={() => setCampaignForm(prev => ({ ...prev, dealType: prev.dealType === d ? '' : d }))}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${campaignForm.dealType === d ? 'bg-green-600 text-white border-green-600 font-semibold' : 'border-ink-200 text-ink-600 hover:border-green-400'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* KPI + Budget */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">KPI / Goal</label>
                  <select className="input" value={campaignForm.kpi} onChange={e => setCampaignForm(f => ({ ...f, kpi: e.target.value }))}>
                    <option value="">Select KPI…</option>
                    {['Brand Awareness','CTR / Clicks','App Installs','Lead Generation','Video Views','Reach & Frequency','Sales / Conversions','Viewability'].map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Budget Range</label>
                  <input className="input" value={campaignForm.budget} onChange={e => setCampaignForm(f => ({ ...f, budget: e.target.value }))} placeholder="e.g. ₹5–10L / $10k–$50k" />
                </div>
              </div>

              {/* Timeline */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start Date</label>
                  <input type="date" className="input" value={campaignForm.startDate} onChange={e => setCampaignForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input type="date" className="input" value={campaignForm.endDate} onChange={e => setCampaignForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>

              {/* Status + Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={editCampaignForm.status || 'active'}
                    onChange={e => setEditCampaignForm((f: any) => ({ ...f, status: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="label">Additional Notes</label>
                  <input className="input" value={campaignForm.notes} onChange={e => setCampaignForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any extra context…" />
                </div>
              </div>

              <div className="flex gap-3 pt-1 border-t border-ink-100">
                <button onClick={updateCampaign} disabled={savingCampaign || !campaignForm.brand.trim()} className="flex-1 btn-primary disabled:opacity-50">
                  {savingCampaign ? 'Saving...' : '✓ Save Changes'}
                </button>
                <button onClick={() => setEditCampaign(null)} className="px-4 py-2 text-sm bg-ink-100 text-ink-600 rounded-xl">Cancel</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Send modal */}
      {sendModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSendModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="card p-6 w-full max-w-sm space-y-4">
              <p className="font-semibold text-ink-900">Send via Gmail</p>
              <p className="text-xs text-ink-400">Gmail will open with the email pre-filled — review and click Send</p>
              <div>
                <label className="label">Your Official Email *</label>
                <input type="email" className="input" value={senderEmail}
                  onChange={e => setSenderEmail(e.target.value)} placeholder="bhanu@adcandid.com" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSendModal(false)} className="flex-1 px-4 py-2 text-sm bg-ink-100 text-ink-600 rounded-xl">Cancel</button>
                <button onClick={sendGmail} disabled={!senderEmail}
                  className="flex-1 btn-primary disabled:opacity-50">Open Gmail →</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
