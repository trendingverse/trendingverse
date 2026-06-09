'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface Publisher {
  id?: string; name: string; site: string; site_url?: string
  category: string; region: string; language: string
  monthly_audience: string; contact_email: string; contact_phone: string
  contact_name?: string; notes?: string; status?: string
  why?: string; fit_score?: number
}

interface Campaign {
  id: string; name: string; brief: string; brand: string
  category: string; target_audience: string; regions: string[]
  budget_range: string; status: string; created_at: string
}

export function OutreachPanel({ isAdmin }: { isAdmin: boolean }) {
  const [tab, setTab] = useState<'campaigns' | 'publishers'>('campaigns')
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

  function openEditCampaign(c: Campaign) {
    setEditCampaign(c)
    setEditCampaignForm({
      name: c.name || '',
      brand: c.brand || '',
      category: c.category || '',
      target_audience: c.target_audience || '',
      budget_range: c.budget_range || '',
      brief: c.brief || '',
      status: c.status || 'active',
    })
  }

  async function updateCampaign() {
    if (!editCampaign) return
    setSavingCampaign(true)
    const res = await fetch('/api/outreach/campaigns', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editCampaign.id, ...editCampaignForm }),
    })
    if (res.ok) {
      toast.success('Campaign updated!')
      setCampaigns(prev => prev.map(c => c.id === editCampaign.id ? { ...c, ...editCampaignForm } : c))
      setEditCampaign(null)
    } else toast.error('Failed to update')
    setSavingCampaign(false)
  }

  async function createCampaign() {
    if (!briefInput.trim()) { toast.error('Paste a campaign brief first'); return }
    setSuggesting(true)
    toast.loading('AI analyzing campaign brief...', { id: 'suggest' })

    const suggestRes = await fetch('/api/outreach/suggest', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief: briefInput, publisher_scope: pubScope }),
    })
    const data = await suggestRes.json()
    toast.dismiss('suggest')

    if (data.error) { toast.error(data.error); setSuggesting(false); return }

    const saveRes = await fetch('/api/outreach/campaigns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: campaignName || (data.summary?.brand || 'Campaign') + ' — Outreach',
        brief: briefInput,
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
    setCampaigns(prev => [saved, ...prev])
    toast.success(`${data.suggestions?.length || 0} publishers matched!`)
    setSuggesting(false)
  }

  async function draftEmail(pub: Publisher, campaignOverride?: Campaign) {
    setDraftingFor(pub)
    setDraftLoading(true)
    setEmailDraft('')
    setSendModal(false)

    // Build campaign summary from: active summary → campaignOverride → selectedCampaignId → most recent campaign
    let campaignSummary = summary
    const sourceC = campaignOverride || campaigns.find(c => c.id === selectedCampaignId) || activeCampaign || campaigns[0]
    if (!campaignSummary && sourceC) {
      campaignSummary = {
        brand: sourceC.brand,
        category: sourceC.category,
        target_audience: sourceC.target_audience,
        regions: sourceC.regions,
        budget_range: sourceC.budget_range,
        key_message: (sourceC as any).key_message || '',
        campaign_type: (sourceC as any).campaign_type || '',
        brief: sourceC.brief,
      }
    }

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
    const headers = ['Publisher Name','Website','Category','Region','Language','Monthly Audience','Contact Email','Phone','Fit Score','Why','Status']
    const rows = pubs.map(p => [
      p.name, p.site || p.site_url || '', p.category, p.region, p.language,
      p.monthly_audience, p.contact_email, p.contact_phone,
      p.fit_score ? p.fit_score + '%' : '—', p.why || '', p.status || 'prospect',
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

  return (
    <div className="space-y-5">
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
            <button onClick={() => { setActiveCampaign(null); setSuggestions([]) }}
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
            <div className="card p-5 space-y-4 border-2 border-accent/20">
              <h3 className="font-semibold text-ink-900">New Campaign Brief</h3>
              <div>
                <label className="label">Campaign Name (optional)</label>
                <input className="input" value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. Diwali Sale 2026" />
              </div>
              <div>
                <label className="label">Paste Campaign Requirements *</label>
                <textarea className="input resize-none" rows={8} value={briefInput}
                  onChange={e => setBriefInput(e.target.value)}
                  placeholder={`Brand: Nykaa\nProduct: Summer skincare range\nTarget Audience: Women 18-35, urban\nRegion: Karnataka, Maharashtra, Tamil Nadu\nBudget: ₹5-10 Lakhs\nGoal: Brand awareness + app installs\nLanguage: Kannada, Hindi, English\nTimeline: June–August 2026\nAd formats: Display banner, native`} />
              </div>
              <div>
                <label className="label">Publisher Scope</label>
                <div className="flex gap-2">
                  {[
                    { k: 'both', l: '🌏 India + Global' },
                    { k: 'india', l: '🇮🇳 India Only' },
                    { k: 'global', l: '🌐 Global Only' },
                  ].map(opt => (
                    <button key={opt.k} onClick={() => setPubScope(opt.k as any)}
                      className={`text-xs px-4 py-2 rounded-xl border transition-colors ${pubScope === opt.k ? 'border-accent bg-accent/5 text-accent font-semibold' : 'border-ink-200 text-ink-600 hover:border-ink-300'}`}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Your Name (for email draft)</label>
                <input className="input" value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="e.g. Bhanu Prakash" />
              </div>
              <div>
                <label className="label">Your Title</label>
                <input className="input" value={senderTitle} onChange={e => setSenderTitle(e.target.value)} placeholder="e.g. Head of Media Buying" />
              </div>
              <div className="flex gap-3">
                <button onClick={createCampaign} disabled={!briefInput.trim() || suggesting} className="btn-primary">
                  {suggesting ? '✦ Analyzing...' : '✦ Analyze & Find Publishers'}
                </button>
                <button onClick={() => { setShowCampaignForm(false); setBriefInput('') }}
                  className="px-4 py-2 text-sm bg-ink-100 text-ink-600 rounded-xl">Cancel</button>
              </div>
            </div>
          )}

          {/* Suggestions */}
          {activeCampaign && suggestions.length > 0 && (
            <div className="card overflow-hidden">
              <div className="p-4 bg-ink-50 border-b border-ink-100 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-ink-900">{activeCampaign.brand || activeCampaign.name}</p>
                  <p className="text-xs text-ink-400">{suggestions.length} matched publishers — save to DB or draft outreach email</p>
                </div>
                <button onClick={() => downloadCSV(suggestions)}
                  className="text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100">
                  ⬇ Export CSV
                </button>
              </div>

              {summary && (
                <div className="px-4 py-3 border-b border-ink-50 flex flex-wrap gap-2">
                  {[
                    { l: 'Brand', v: summary.brand },
                    { l: 'Category', v: summary.category },
                    { l: 'Audience', v: summary.target_audience },
                    { l: 'Regions', v: (summary.regions || []).join(', ') },
                    { l: 'Budget', v: summary.budget_range },
                    { l: 'Goal', v: summary.key_message },
                  ].filter(s => s.v).map(s => (
                    <span key={s.l} className="text-xs bg-ink-100 text-ink-600 px-2 py-0.5 rounded-full">
                      <span className="text-ink-400">{s.l}:</span> {s.v}
                    </span>
                  ))}
                </div>
              )}

              <div className="divide-y divide-ink-50">
                {suggestions.map((pub, i) => {
                  const saved = alreadySaved(pub)
                  return (
                    <div key={i} className="px-4 py-3 hover:bg-ink-50/50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <span className="text-xs text-ink-400 w-5 shrink-0 mt-0.5">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <p className="text-sm font-semibold text-ink-900">{pub.name}</p>
                              <a href={`https://${pub.site}`} target="_blank" rel="noreferrer"
                                className="text-xs text-blue-500 hover:underline">{pub.site}</a>
                              {saved && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">✓ Saved</span>}
                            </div>
                            <p className="text-xs text-ink-400">{pub.region} · {pub.language} · {pub.monthly_audience}</p>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {(pub as any).ctv_available && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">📺 CTV</span>}
                              {(pub as any).pmp_supported && <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-medium">🔒 PMP</span>}
                            </div>
                            {pub.why && <p className="text-xs text-blue-600 mt-1">{pub.why}</p>}
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-ink-500">📧 {pub.contact_email}</span>
                              <span className="text-xs text-ink-500">📞 {pub.contact_phone}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className="text-right">
                            <p className={`text-base font-bold ${fitColor(pub.fit_score)}`}>{pub.fit_score}%</p>
                            <p className="text-xs text-ink-400">fit</p>
                          </div>
                          <div className="flex gap-1.5">
                            {!saved && (
                              <button onClick={() => savePublisher(pub)} disabled={savingPub === pub.name}
                                className="text-xs px-2.5 py-1.5 bg-ink-100 text-ink-600 rounded-lg hover:bg-ink-200 disabled:opacity-50">
                                {savingPub === pub.name ? '...' : '+ Save'}
                              </button>
                            )}
                            <button onClick={() => draftEmail(pub)}
                              className="text-xs px-3 py-1.5 bg-accent text-white rounded-lg hover:bg-accent/90">
                              ✉ Draft Email
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Campaigns list */}
          {campaigns.length === 0 && !showCampaignForm ? (
            <div className="card p-8 text-center">
              <p className="text-2xl mb-2">📋</p>
              <p className="text-sm text-ink-500 mb-1">No campaigns yet</p>
              <p className="text-xs text-ink-400">Paste a campaign brief to find matching publishers and draft outreach emails</p>
            </div>
          ) : campaigns.length > 0 && !activeCampaign && !showCampaignForm && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-ink-50 border-b border-ink-100">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-ink-500">Campaign</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Category</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Budget</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Status</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-500">Date</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Action</th>
                </tr></thead>
                <tbody>
                  {campaigns.map(c => (
                    <tr key={c.id} className="border-b border-ink-50 hover:bg-ink-50/50">
                      <td className="px-4 py-2.5">
                        <p className="text-xs font-medium text-ink-900">{c.name || c.brand}</p>
                        <p className="text-xs text-ink-400 truncate max-w-xs">{c.target_audience}</p>
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-ink-600">{c.category}</td>
                      <td className="px-3 py-2.5 text-center text-xs text-ink-600">{c.budget_range || '—'}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full capitalize">{c.status}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-ink-400">
                        {new Date(c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEditCampaign(c)}
                            className="text-xs px-2 py-1 bg-ink-100 text-ink-600 rounded-lg hover:bg-ink-200">✏ Edit</button>
                          {isAdmin && (
                            <button onClick={() => deleteCampaign(c.id)}
                              className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg">🗑</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                <label className="label">Your Name</label>
                <input className="input" value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Bhanu Prakash" />
              </div>
              <div>
                <label className="label">Your Title</label>
                <input className="input" value={senderTitle} onChange={e => setSenderTitle(e.target.value)} placeholder="Head of Media Buying" />
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

      {/* Edit Campaign Modal */}
      {editCampaign && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setEditCampaign(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="card p-6 w-full max-w-lg space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink-900">✏ Edit Campaign</p>
                <button onClick={() => setEditCampaign(null)} className="text-xs text-ink-400 hover:text-ink-600">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Campaign Name</label>
                  <input className="input" value={editCampaignForm.name || ''}
                    onChange={e => setEditCampaignForm((f: any) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Brand</label>
                  <input className="input" value={editCampaignForm.brand || ''}
                    onChange={e => setEditCampaignForm((f: any) => ({ ...f, brand: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Category</label>
                  <input className="input" value={editCampaignForm.category || ''}
                    onChange={e => setEditCampaignForm((f: any) => ({ ...f, category: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Target Audience</label>
                  <input className="input" value={editCampaignForm.target_audience || ''}
                    onChange={e => setEditCampaignForm((f: any) => ({ ...f, target_audience: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Budget Range</label>
                  <input className="input" value={editCampaignForm.budget_range || ''}
                    onChange={e => setEditCampaignForm((f: any) => ({ ...f, budget_range: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={editCampaignForm.status || 'active'}
                    onChange={e => setEditCampaignForm((f: any) => ({ ...f, status: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Campaign Brief</label>
                  <textarea className="input resize-none" rows={4} value={editCampaignForm.brief || ''}
                    onChange={e => setEditCampaignForm((f: any) => ({ ...f, brief: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={updateCampaign} disabled={savingCampaign} className="flex-1 btn-primary disabled:opacity-50">
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
