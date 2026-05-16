'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import type { AdSlot, AffiliateLink } from '@/types'

export function MonetizationPanel({ adSlots: initialSlots, affiliates: initialAff }: { adSlots: AdSlot[]; affiliates: AffiliateLink[] }) {
  const [slots, setSlots] = useState(initialSlots)
  const [affiliates, setAffiliates] = useState(initialAff)
  const [tab, setTab] = useState<'ads'|'affiliate'|'analytics'>('ads')
  const [saving, setSaving] = useState(false)

  // Ad slot edit
  const [editSlot, setEditSlot] = useState<AdSlot|null>(null)

  // New affiliate form
  const [affName, setAffName] = useState('')
  const [affUrl, setAffUrl] = useState('')
  const [affKws, setAffKws] = useState('')
  const [affComm, setAffComm] = useState('')

  async function saveSlot(slot: AdSlot) {
    setSaving(true)
    const res = await fetch(`/api/adslots/${slot.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(slot) })
    if (res.ok) { const d = await res.json(); setSlots(s=>s.map(x=>x.id===d.id?d:x)); setEditSlot(null); toast.success('Ad slot saved') }
    else toast.error('Save failed')
    setSaving(false)
  }

  async function toggleSlot(id: string, active: boolean) {
    const res = await fetch(`/api/adslots/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ is_active: !active }) })
    if (res.ok) setSlots(s=>s.map(x=>x.id===id?{...x,is_active:!active}:x))
  }

  async function createAffiliate() {
    if (!affName||!affUrl) { toast.error('Name and URL required'); return }
    const keywords = affKws.split(',').map(k=>k.trim()).filter(Boolean)
    if (!keywords.length) { toast.error('Add at least one keyword'); return }
    setSaving(true)
    const res = await fetch('/api/affiliate', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name:affName, url:affUrl, trigger_keywords:keywords, commission_pct:affComm?parseFloat(affComm):null, is_active:true }) })
    if (res.ok) {
      const d = await res.json(); setAffiliates(a=>[d,...a])
      setAffName(''); setAffUrl(''); setAffKws(''); setAffComm('')
      toast.success('Affiliate link created')
    } else toast.error('Create failed')
    setSaving(false)
  }

  async function toggleAffiliate(id: string, active: boolean) {
    const res = await fetch(`/api/affiliate/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ is_active: !active }) })
    if (res.ok) setAffiliates(a=>a.map(x=>x.id===id?{...x,is_active:!active}:x))
  }

  async function deleteAffiliate(id: string) {
    if (!confirm('Delete this affiliate link?')) return
    const res = await fetch(`/api/affiliate/${id}`, { method:'DELETE' })
    if (res.ok) { setAffiliates(a=>a.filter(x=>x.id!==id)); toast.success('Deleted') }
  }

  const positionLabels: Record<string, string> = { header:'728×90 Header', inline:'336×280 In-Article', sidebar:'300×250 Sidebar', footer:'728×90 Footer' }

  return (
    <div className="space-y-5">
      <div className="flex gap-1 p-1 bg-ink-100 rounded-xl w-fit">
        {([['ads','Ad Slots'],['affiliate','Affiliate Links'],['analytics','Revenue Analytics']] as const).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab===t?'bg-white shadow text-ink-900':'text-ink-500 hover:text-ink-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ADS */}
      {tab==='ads' && (
        <div className="space-y-4">
          <div className="card p-4 bg-amber-50 border-amber-100">
            <p className="text-sm text-amber-800"><strong>Setup:</strong> Add your AdSense publisher ID to <code className="bg-amber-100 px-1 rounded">.env.local</code> as <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_ADSENSE_CLIENT</code>, then set each slot ID below.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {slots.map(slot=>(
              <div key={slot.id} className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-ink-900">{slot.name}</p>
                    <p className="text-xs text-ink-400">{positionLabels[slot.position] || slot.position}</p>
                  </div>
                  <button onClick={()=>toggleSlot(slot.id, slot.is_active)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${slot.is_active?'bg-emerald-500':'bg-ink-200'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${slot.is_active?'translate-x-6':'translate-x-1'}`}/>
                  </button>
                </div>
                {editSlot?.id===slot.id ? (
                  <div className="space-y-2">
                    <input value={editSlot.adsense_slot_id||''} onChange={e=>setEditSlot({...editSlot,adsense_slot_id:e.target.value})}
                      className="input text-xs font-mono" placeholder="AdSense Slot ID (e.g. 1234567890)"/>
                    <div className="flex gap-2">
                      <button onClick={()=>saveSlot(editSlot)} disabled={saving} className="btn-primary btn-sm flex-1 justify-center">Save</button>
                      <button onClick={()=>setEditSlot(null)} className="btn-secondary btn-sm">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <code className="text-xs text-ink-500 bg-ink-50 px-2 py-1 rounded">{slot.adsense_slot_id||'No slot ID set'}</code>
                    <button onClick={()=>setEditSlot({...slot})} className="btn-ghost btn-sm">Edit</button>
                  </div>
                )}
                <div className="h-16 bg-ink-50 border border-dashed border-ink-200 rounded-lg flex items-center justify-center">
                  <span className="text-xs text-ink-300">{positionLabels[slot.position]} Preview</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AFFILIATE */}
      {tab==='affiliate' && (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-ink-900">Add Affiliate Link</h3>
            <p className="text-xs text-ink-500">Keywords trigger automatic insertion of affiliate links in article content.</p>
            <div>
              <label className="label">Link Name *</label>
              <input value={affName} onChange={e=>setAffName(e.target.value)} className="input" placeholder="e.g. Amazon India"/>
            </div>
            <div>
              <label className="label">Affiliate URL *</label>
              <input value={affUrl} onChange={e=>setAffUrl(e.target.value)} className="input" placeholder="https://affiliate.example.com/?ref=tv"/>
            </div>
            <div>
              <label className="label">Trigger Keywords (comma-separated) *</label>
              <input value={affKws} onChange={e=>setAffKws(e.target.value)} className="input" placeholder="Amazon, buy online, e-commerce"/>
            </div>
            <div>
              <label className="label">Commission % (optional)</label>
              <input value={affComm} onChange={e=>setAffComm(e.target.value)} type="number" step="0.01" className="input" placeholder="5.00"/>
            </div>
            <button onClick={createAffiliate} disabled={saving} className="btn-primary w-full justify-center">
              {saving?'Adding…':'Add Affiliate Link'}
            </button>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-ink-100">
              <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide">{affiliates.length} Affiliate Links</p>
            </div>
            <div className="divide-y divide-ink-50 max-h-[500px] overflow-y-auto">
              {affiliates.map(a=>(
                <div key={a.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-ink-900 truncate">{a.name}</p>
                      {a.commission_pct && <span className="badge bg-emerald-50 text-emerald-700">{a.commission_pct}%</span>}
                    </div>
                    <p className="text-xs text-ink-400 truncate mb-1">{a.url}</p>
                    <div className="flex flex-wrap gap-1">
                      {a.trigger_keywords.map(kw=><span key={kw} className="px-1.5 py-0.5 bg-ink-50 text-ink-500 rounded text-xs">{kw}</span>)}
                    </div>
                    <p className="text-xs text-ink-400 mt-1">{a.click_count} clicks</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={()=>toggleAffiliate(a.id, a.is_active)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${a.is_active?'bg-emerald-500':'bg-ink-200'}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${a.is_active?'translate-x-4':'translate-x-0.5'}`}/>
                    </button>
                    <button onClick={()=>deleteAffiliate(a.id)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                  </div>
                </div>
              ))}
              {affiliates.length===0 && <p className="px-4 py-8 text-center text-sm text-ink-300">No affiliate links yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ANALYTICS */}
      {tab==='analytics' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label:'Total Affiliate Links', val: affiliates.length, color:'text-violet-600' },
            { label:'Active Links', val: affiliates.filter(a=>a.is_active).length, color:'text-emerald-600' },
            { label:'Total Clicks', val: affiliates.reduce((s,a)=>s+a.click_count,0), color:'text-blue-600' },
            { label:'Active Ad Slots', val: slots.filter(s=>s.is_active).length, color:'text-accent' },
            { label:'Configured Slots', val: slots.filter(s=>s.adsense_slot_id).length, color:'text-amber-600' },
            { label:'Sponsored Articles', val: '—', color:'text-ink-600' },
          ].map(c=>(
            <div key={c.label} className="card p-5">
              <p className="text-xs text-ink-400 mb-1">{c.label}</p>
              <p className={`text-3xl font-display font-bold ${c.color}`}>{c.val}</p>
            </div>
          ))}
          <div className="card p-5 col-span-full">
            <p className="text-sm font-semibold text-ink-700 mb-2">Revenue Tracking</p>
            <p className="text-sm text-ink-500">Connect Google Analytics or a dedicated revenue dashboard for full CTR and earnings data. AdSense earnings are available directly in your <a href="https://adsense.google.com" target="_blank" className="text-accent hover:underline">AdSense dashboard</a>.</p>
          </div>
        </div>
      )}
    </div>
  )
}
