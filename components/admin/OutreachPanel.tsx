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

const STATUS_COLORS: Record<string, string> = {
  prospect:  'bg-ink-100 text-ink-600',
  contacted: 'bg-blue-100 text-blue-700',
  responded: 'bg-amber-100 text-amber-700',
  onboarded: 'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-600',
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
  const [showCampaignForm, setShowCampaignForm] = useState(false)
  const [showPubForm, setShowPubForm] = useState(false)
  const [briefInput, setBriefInput] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [pubForm, setPubForm] = useState<Partial<Publisher>>({})

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

  async function createCampaign() {
    if (!briefInput.trim()) { toast.error('Paste a campaign brief first'); return }
    setSuggesting(true)
    toast.loading('AI analyzing brief...', { id: 'suggest' })

    const suggestRes = await fetch('/api/outreach/suggest', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brief: briefInput }),
    })
    const data = await suggestRes.json()
    toast.dismiss('suggest')

    if (data.error) { toast.error(data.error); setSuggesting(false); return }

    const saveRes = await fetch('/api/outreach/campaigns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: campaignName || data.summary?.brand + ' Campaign',
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
    setCampaigns(prev => [saved, ...prev])
    toast.success(`${data.suggestions?.length} publishers matched!`)
    setSuggesting(false)
  }

  async function draftEmail(pub: Publisher) {
    setDraftingFor(pub)
    setDraftLoading(true)
    setEmailDraft('')
    setSendModal(false)

    const res = await fetch('/api/outreach/draft-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publisher: pub, campaign_summary: summary }),
    })
    const data = await res.json()
    setEmailDraft(data.draft || '')
    setDraftLoading(false)
  }

  async function savePublisher(pub: Publisher) {
    const res = await fetch('/api/outreach/publishers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pub),
    })
    if (res.ok) {
      const saved = await res.json()
      setPublishers(prev => [saved, ...prev])
      toast.success(`${pub.name} saved to database!`)
    }
  }

  async function updateStatus(id: string, status: string) {
    await fetch('/api/outreach/publishers', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    setPublishers(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    toast.success('Status updated')
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
    a.download = `TrendingVerse-Outreach-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  function sendGmail() {
    if (!senderEmail || !emailDraft || !draftingFor) return
    const lines = emailDraft.split('\n')
    const subjectLine = lines.find(l => l.startsWith('Subject:'))?.replace('Subject:', '').trim() || 'Partnership Opportunity — TrendingVerse'
    const body = lines.slice(lines.findIndex(l => l.startsWith('Subject:')) + 2).join('\n')
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(draftingFor.contact_email)}&su=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`
    window.open(url, '_blank')
    setSendModal(false)
    if (draftingFor.id) updateStatus(draftingFor.id, 'contacted')
  }

  const fitColor = (score = 75) => score >= 90 ? 'text-green-600' : score >= 75 ? 'text-amber-600' : 'text-red-500'

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
          {tab === 'campaigns' && (
            <button onClick={() => setShowCampaignForm(true)} className="btn-primary text-xs px-4 py-2">+ New Campaign</button>
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

      {/* ── CAMPAIGNS TAB ── */}
      {tab === 'campaigns' && (
        <div className="space-y-4">
          {showCampaignForm && (
            <div className="card p-5 space-y-4 border-2 border-accent/20">
              <h3 className="font-semibold text-ink-900">New Campaign Brief</h3>
              <div>
                <label className="label">Campaign Name (optional)</label>
                <input className="input" value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. Diwali Sale 2026" />
              </div>
              <div>
                <label className="label">Paste Campaign Brief *</label>
                <textarea className="input resize-none" rows={7} value={briefInput}
                  onChange={e => setBriefInput(e.target.value)}
                  placeholder={`Brand: Nykaa\nProduct: Summer skincare\nTarget: Women 18-35\nRegion: Karnataka, Maharashtra\nBudget: ₹5-10L\nGoal: Brand awareness + conversions\nLanguage: Kannada, Hindi, English\nTimeline: June–August 2026`} />
              </div>
              <div className="flex gap-3">
                <button onClick={createCampaign} disabled={!briefInput.trim() || suggesting} className="btn-primary">
                  {suggesting ? '✦ Analyzing...' : '✦ Analyze & Find Publishers'}
                </button>
                <button onClick={() => setShowCampaignForm(false)} className="px-4 py-2 text-sm bg-ink-100 text-ink-600 rounded-xl">Cancel</button>
              </div>
            </div>
          )}

          {activeCampaign && suggestions.length > 0 && (
            <div className="card overflow-hidden">
              <div className="p-4 bg-ink-50 border-b border-ink-100 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-ink-900">{activeCampaign.brand || activeCampaign.name}</p>
                  <p className="text-xs text-ink-400">{suggestions.length} AI-matched publishers</p>
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
                  ].filter(s => s.v).map(s => (
                    <span key={s.l} className="text-xs bg-ink-100 text-ink-600 px-2 py-0.5 rounded-full">
                      <span className="text-ink-400">{s.l}:</span> {s.v}
                    </span>
                  ))}
                </div>
              )}

              <div className="divide-y divide-ink-50">
                {suggestions.map((pub, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-ink-50/50">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <span className="text-xs text-ink-400 w-5 shrink-0">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink-900">{pub.name}</p>
                        <p className="text-xs text-ink-400">{pub.site} · {pub.region} · {pub.language}</p>
                        {pub.why && <p className="text-xs text-blue-600 mt-0.5">{pub.why}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${fitColor(pub.fit_score)}`}>{pub.fit_score}%</p>
                        <p className="text-xs text-ink-400">{pub.monthly_audience}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => savePublisher(pub)}
                        className="text-xs px-2 py-1.5 bg-ink-100 text-ink-600 rounded-lg hover:bg-ink-200">
                        + Save
                      </button>
                      <button onClick={() => draftEmail(pub)}
                        className="text-xs px-3 py-1.5 bg-accent text-white rounded-lg hover:bg-accent/90">
                        ✉ Draft Email
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {campaigns.length === 0 && !showCampaignForm ? (
            <div className="card p-8 text-center">
              <p className="text-2xl mb-2">📋</p>
              <p className="text-sm text-ink-500 mb-1">No campaigns yet</p>
              <p className="text-xs text-ink-400">Paste a campaign brief to find matching publishers</p>
            </div>
          ) : campaigns.length > 0 && !activeCampaign && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-ink-50 border-b border-ink-100">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-ink-500">Campaign</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Category</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Budget</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Status</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-500">Date</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── PUBLISHERS DB TAB ── */}
      {tab === 'publishers' && (
        <div className="space-y-4">
          {showPubForm && (
            <div className="card p-5 space-y-4 border-2 border-accent/20">
              <h3 className="font-semibold text-ink-900">Add Publisher</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { l: 'Publisher Name *', k: 'name', placeholder: 'DailyKannada News' },
                  { l: 'Website', k: 'site', placeholder: 'kannadadunia.com' },
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
                    onChange={e => setPubForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any notes about this publisher" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={async () => {
                  if (!pubForm.name || !pubForm.contact_email) { toast.error('Name and email required'); return }
                  await savePublisher(pubForm as Publisher)
                  setShowPubForm(false)
                  setPubForm({})
                }} className="btn-primary">Save Publisher</button>
                <button onClick={() => setShowPubForm(false)} className="px-4 py-2 text-sm bg-ink-100 text-ink-600 rounded-xl">Cancel</button>
              </div>
            </div>
          )}

          {publishers.length === 0 && !showPubForm ? (
            <div className="card p-8 text-center">
              <p className="text-2xl mb-2">🏢</p>
              <p className="text-sm text-ink-500 mb-1">No publishers saved yet</p>
              <p className="text-xs text-ink-400">Add publishers manually or save from AI campaign suggestions</p>
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
              <p className="font-semibold text-ink-900">✉ Email Draft — {draftingFor.name}</p>
              <p className="text-xs text-ink-400">{draftingFor.contact_email}</p>
            </div>
            <button onClick={() => setDraftingFor(null)} className="text-xs text-ink-400 hover:text-ink-600">✕ Close</button>
          </div>
          {draftLoading ? (
            <div className="h-48 bg-ink-50 rounded-xl flex items-center justify-center text-xs text-ink-400">
              ✦ Drafting professional email...
            </div>
          ) : (
            <textarea className="input w-full resize-none font-mono text-xs leading-relaxed" rows={12}
              value={emailDraft} onChange={e => setEmailDraft(e.target.value)} />
          )}
          <div className="flex gap-2 mt-3">
            <button onClick={() => draftEmail(draftingFor)} className="text-xs px-3 py-2 bg-ink-100 text-ink-600 rounded-xl hover:bg-ink-200">↺ Regenerate</button>
            <button onClick={() => { navigator.clipboard.writeText(emailDraft); toast.success('Copied!') }}
              className="text-xs px-3 py-2 bg-ink-100 text-ink-600 rounded-xl hover:bg-ink-200">⎘ Copy</button>
            <button onClick={() => setSendModal(true)} disabled={draftLoading || !emailDraft}
              className="flex-1 btn-primary text-xs py-2 disabled:opacity-50">✉ Send via Gmail</button>
          </div>
        </div>
      )}

      {/* Send modal */}
      {sendModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSendModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="card p-6 w-full max-w-sm space-y-4">
              <p className="font-semibold text-ink-900">Send via Gmail</p>
              <p className="text-xs text-ink-400">Enter your official email — Gmail will open with the email pre-filled and ready to send</p>
              <div>
                <label className="label">Your Official Email</label>
                <input type="email" className="input" value={senderEmail}
                  onChange={e => setSenderEmail(e.target.value)} placeholder="you@yourcompany.com" />
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
