'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

interface Subscriber { id:string; email:string; name?:string; is_active:boolean; subscribed_at:string }
interface Campaign { id:string; subject:string; status:string; sent_at?:string; sent_count:number; created_at:string }

export function SettingsPanel({ settings: initial, subscribers, campaigns }: { settings: Record<string,string>; subscribers: Subscriber[]; campaigns: Campaign[] }) {
  const [settings, setSettings] = useState(initial)
  const [tab, setTab] = useState<'general'|'newsletter'|'integrations'>('general')
  const [saving, setSaving] = useState(false)
  const [subs, setSubs] = useState(subscribers)

  // Newsletter compose
  const [subject, setSubject] = useState('')
  const [preview, setPreview] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  function update(key: string, val: string) { setSettings(s=>({...s,[key]:val})) }

  async function saveSettings() {
    setSaving(true)
    const res = await fetch('/api/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(settings) })
    if (res.ok) toast.success('Settings saved')
    else toast.error('Save failed')
    setSaving(false)
  }

  async function sendNewsletter() {
    if (!subject||!body) { toast.error('Subject and body required'); return }
    setSending(true)
    const res = await fetch('/api/newsletter/campaigns', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ subject, preview_text: preview, html_content: body, status: 'sent', sent_at: new Date().toISOString(), sent_count: subs.filter(s=>s.is_active).length }) })
    if (res.ok) { toast.success('Newsletter campaign saved!'); setSubject(''); setPreview(''); setBody('') }
    else toast.error('Failed')
    setSending(false)
  }

  const activeCount = subs.filter(s=>s.is_active).length

  const generalFields = [
    { key:'site_name', label:'Site Name' },
    { key:'tagline', label:'Tagline' },
    { key:'site_url', label:'Site URL' },
    { key:'footer_text', label:'Footer Text' },
    { key:'articles_per_page', label:'Articles Per Page', type:'number' },
  ]
  const integrationFields = [
    { key:'adsense_client', label:'AdSense Publisher ID', placeholder:'ca-pub-XXXXXXXXXXXXXXXX' },
    { key:'google_analytics_id', label:'Google Analytics ID', placeholder:'G-XXXXXXXXXX' },
    { key:'og_default_image', label:'Default OG Image URL', placeholder:'https://…' },
    { key:'twitter_handle', label:'Twitter Handle', placeholder:'@trendingverse' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex gap-1 p-1 bg-ink-100 rounded-xl w-fit">
        {([['general','General'],['newsletter','Newsletter'],['integrations','Integrations']] as const).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab===t?'bg-white shadow text-ink-900':'text-ink-500 hover:text-ink-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab==='general' && (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-ink-900">Site Settings</h3>
            {generalFields.map(f=>(
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <input value={settings[f.key]||''} onChange={e=>update(f.key,e.target.value)} type={f.type||'text'} className="input"/>
              </div>
            ))}
            <button onClick={saveSettings} disabled={saving} className="btn-primary w-full justify-center">
              {saving?'Saving…':'Save Settings'}
            </button>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold text-ink-900 mb-4">Site Preview</h3>
            <div className="bg-ink-950 rounded-xl p-5 text-center">
              <p className="font-display text-2xl font-bold text-white">{settings.site_name||'TrendingVerse'}</p>
              <p className="text-sm text-ink-400 mt-1">{settings.tagline||'Breaking News & Trending Stories'}</p>
              <p className="text-xs text-ink-600 mt-3">{settings.site_url||'https://trendingverse.online'}</p>
            </div>
          </div>
        </div>
      )}

      {tab==='newsletter' && (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-ink-900">Compose Newsletter</h3>
                <span className="badge bg-emerald-50 text-emerald-700">{activeCount} subscribers</span>
              </div>
              <div>
                <label className="label">Subject *</label>
                <input value={subject} onChange={e=>setSubject(e.target.value)} className="input" placeholder="Weekly digest: Top stories this week"/>
              </div>
              <div>
                <label className="label">Preview Text</label>
                <input value={preview} onChange={e=>setPreview(e.target.value)} className="input" placeholder="Short preview shown in inbox…"/>
              </div>
              <div>
                <label className="label">HTML Body *</label>
                <textarea value={body} onChange={e=>setBody(e.target.value)} rows={8} className="input resize-none font-mono text-xs" placeholder="<p>Hello readers,</p>…"/>
              </div>
              <button onClick={sendNewsletter} disabled={sending} className="btn-primary w-full justify-center">
                {sending?'Sending…':`Send to ${activeCount} subscribers`}
              </button>
            </div>
          </div>
          <div className="space-y-4">
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-ink-100 flex items-center justify-between">
                <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide">Subscribers ({subs.length})</p>
              </div>
              <div className="divide-y divide-ink-50 max-h-64 overflow-y-auto">
                {subs.slice(0,20).map(s=>(
                  <div key={s.id} className="px-5 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-ink-800">{s.email}</p>
                      {s.name && <p className="text-xs text-ink-400">{s.name}</p>}
                    </div>
                    <span className={`badge ${s.is_active?'badge-published':'badge-archived'}`}>{s.is_active?'Active':'Unsubscribed'}</span>
                  </div>
                ))}
                {subs.length===0 && <p className="p-6 text-center text-sm text-ink-300">No subscribers yet.</p>}
              </div>
            </div>
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-ink-100">
                <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide">Past Campaigns</p>
              </div>
              <div className="divide-y divide-ink-50 max-h-48 overflow-y-auto">
                {campaigns.slice(0,10).map(c=>(
                  <div key={c.id} className="px-5 py-2.5">
                    <p className="text-sm font-medium text-ink-800 truncate">{c.subject}</p>
                    <p className="text-xs text-ink-400 mt-0.5">{c.sent_count} sent · {c.status} · {new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
                {campaigns.length===0 && <p className="p-4 text-center text-sm text-ink-300">No campaigns yet.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab==='integrations' && (
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-ink-900">Integrations & APIs</h3>
            {integrationFields.map(f=>(
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <input value={settings[f.key]||''} onChange={e=>update(f.key,e.target.value)} className="input font-mono text-xs" placeholder={f.placeholder}/>
              </div>
            ))}
            <div>
  <label className="block text-xs font-medium text-ink-500 mb-1">WORDPRESS SITE URL</label>
  <input className="input w-full" placeholder="https://trendingverse.online"
    value={form.wp_url || ''} onChange={e => setForm({...form, wp_url: e.target.value})} />
</div>
<div>
  <label className="block text-xs font-medium text-ink-500 mb-1">WORDPRESS USERNAME</label>
  <input className="input w-full" placeholder="admin"
    value={form.wp_username || ''} onChange={e => setForm({...form, wp_username: e.target.value})} />
</div>
<div>
  <label className="block text-xs font-medium text-ink-500 mb-1">WORDPRESS APPLICATION PASSWORD</label>
  <input className="input w-full" type="password" placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
    value={form.wp_password || ''} onChange={e => setForm({...form, wp_password: e.target.value})} />
</div>
            <button onClick={saveSettings} disabled={saving} className="btn-primary w-full justify-center">
              {saving?'Saving…':'Save Integrations'}
            </button>
          </div>
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-ink-900">Quick Checklist</h3>
            {[
              { label:'Supabase connected', check: !!process.env.NEXT_PUBLIC_SUPABASE_URL, note:'Database & auth' },
              { label:'Gemini AI key', check: false, note:'Set GEMINI_API_KEY in Vercel env' },
              { label:'AdSense configured', check: !!settings.adsense_client, note:'Add publisher ID above' },
              { label:'Google Analytics', check: !!settings.google_analytics_id, note:'Add GA4 ID above' },
              { label:'OG image set', check: !!settings.og_default_image, note:'Default social share image' },
            ].map(item=>(
              <div key={item.label} className="flex items-center gap-3 p-3 bg-surface-2 rounded-lg">
                <span className={`text-lg ${item.check?'text-emerald-500':'text-ink-300'}`}>{item.check?'✓':'○'}</span>
                <div>
                  <p className="text-sm font-medium text-ink-800">{item.label}</p>
                  <p className="text-xs text-ink-400">{item.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
