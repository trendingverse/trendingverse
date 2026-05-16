'use client'
import { useState } from 'react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Subscriber { id:string; email:string; name?:string; is_active:boolean; subscribed_at:string }
interface Campaign { id:string; subject:string; status:string; sent_at?:string; sent_count:number; created_at:string }

export function NewsletterPanel({ subscribers: initial, campaigns: initialCampaigns }: { subscribers: Subscriber[]; campaigns: Campaign[] }) {
  const [subscribers, setSubscribers] = useState(initial)
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [tab, setTab] = useState<'compose'|'subscribers'|'campaigns'>('compose')
  const [sending, setSending] = useState(false)
  const [subject, setSubject] = useState('')
  const [preview, setPreview] = useState('')
  const [body, setBody] = useState('')
  const activeCount = subscribers.filter(s => s.is_active).length

  async function sendCampaign() {
    if (!subject || !body) { toast.error('Subject and body required'); return }
    setSending(true)
    const res = await fetch('/api/newsletter/campaigns', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ subject, preview_text: preview, html_content: body, status:'sent', sent_at: new Date().toISOString(), sent_count: activeCount }) })
    if (res.ok) { const d = await res.json(); setCampaigns(c=>[d,...c]); setSubject(''); setPreview(''); setBody(''); toast.success('Campaign saved!'); setTab('campaigns') }
    else toast.error('Failed')
    setSending(false)
  }

  async function saveDraft() {
    if (!subject) { toast.error('Subject required'); return }
    setSending(true)
    const res = await fetch('/api/newsletter/campaigns', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ subject, preview_text: preview, html_content: body||'', status:'draft', sent_count:0 }) })
    if (res.ok) { const d = await res.json(); setCampaigns(c=>[d,...c]); toast.success('Draft saved') }
    setSending(false)
  }

  async function exportCSV() {
    const csv = ['Email,Name,Status,Date',...subscribers.map(s=>`${s.email},${s.name||''},${s.is_active?'Active':'Unsubscribed'},${formatDate(s.subscribed_at)}`)].join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='subscribers.csv'; a.click()
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4"><p className="text-xs text-ink-400">Total Subscribers</p><p className="text-3xl font-display font-bold text-ink-950">{subscribers.length}</p></div>
        <div className="card p-4"><p className="text-xs text-ink-400">Active</p><p className="text-3xl font-display font-bold text-emerald-600">{activeCount}</p></div>
        <div className="card p-4"><p className="text-xs text-ink-400">Campaigns Sent</p><p className="text-3xl font-display font-bold text-violet-600">{campaigns.filter(c=>c.status==='sent').length}</p></div>
      </div>
      <div className="flex gap-1 p-1 bg-ink-100 rounded-xl w-fit">
        {(['compose','subscribers','campaigns'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab===t?'bg-white shadow text-ink-900':'text-ink-500 hover:text-ink-700'}`}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>
      {tab==='compose' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-ink-900">Compose Newsletter</h3>
            <div><label className="label">Subject *</label><input va
