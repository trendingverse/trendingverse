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

  // Compose
  const [subject, setSubject] = useState('')
  const [preview, setPreview] = useState('')
  const [body, setBody] = useState('')

  const activeCount = subscribers.filter(s => s.is_active).length

  async function sendCampaign() {
    if (!subject || !body) { toast.error('Subject and body are required'); return }
    setSending(true)
    try {
      const res = await fetch('/api/newsletter/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject, preview_text: preview, html_content: body,
          status: 'sent', sent_at: new Date().toISOString(), sent_count: activeCount
        })
      })
      if (res.ok) {
        const d = await res.json()
        setCampaigns(c => [d, ...c])
        setSubject(''); setPreview(''); setBody('')
        toast.success(`Campaign saved! ${activeCount} subscribers notified.`)
        setTab('campaigns')
      } else toast.error('Failed to send')
    } catch { toast.error('Something went wrong') }
    setSending(false)
  }

  async function saveDraft() {
    if (!subject) { toast.error('Subject required'); return }
    setSending(true)
    try {
      const res = await fetch('/api/newsletter/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, preview_text: preview, html_content: body || '', status: 'draft', sent_count: 0 })
      })
      if (res.ok) {
        const d = await res.json()
        setCampaigns(c => [d, ...c])
        toast.success('Draft saved')
      }
    } catch { toast.error('Save failed') }
    setSending(false)
  }

  async function toggleSubscriber(id: string, active: boolean) {
    const res = await fetch(`/api/newsletter/subscribers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !active })
    })
    if (res.ok) setSubscribers(s => s.map(x => x.id === id ? { ...x, is_active: !active } : x))
  }

  async function exportCSV() {
    const csv = ['Email,Name,Status,Date', ...subscribers.map(s =>
      `${s.email},${s.name || ''},${s.is_active ? 'Active' : 'Unsubscribed'},${formatDate(s.subscribed_at)}`)
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = 'subscribers.csv'; a.click()
    toast.success('CSV downloaded')
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-ink-400">Total Subscribers</p>
          <p className="text-3xl font-display font-bold text-ink-950">{subscribers.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-ink-400">Active</p>
          <p className="text-3xl font-display font-bold text-emerald-600">{activeCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-ink-400">Campaigns Sent</p>
          <p className="text-3xl font-display font-bold text-violet-600">{campaigns.filter(c => c.status === 'sent').length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-ink-100 rounded-xl w-fit">
        {([['compose', '✉ Compose'], ['subscribers', 'Subscribers'], ['campaigns', 'Campaigns']] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t ? 'bg-white shadow text-ink-900' : 'text-ink-500 hover:text-ink-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* COMPOSE */}
      {tab === 'compose' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-ink-900">Compose Newsletter</h3>
            <div>
              <label className="label">Subject Line *</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} className="input"
                placeholder="This week's top stories on TrendingVerse" />
            </div>
            <div>
              <label className="label">Preview Text</label>
              <input value={preview} onChange={e => setPreview(e.target.value)} className="input"
                placeholder="Short text shown in inbox preview…" />
            </div>
            <div>
              <label className="label">Email Body (HTML or plain text) *</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={10}
                className="input resize-none font-mono text-xs"
                placeholder={`<h2>Hello readers,</h2>\n<p>Here are this week's top stories...</p>\n<ul>\n  <li><a href="https://trendingverse.online/article/slug">Article title</a></li>\n</ul>`} />
            </div>
            <div className="flex gap-2">
              <button onClick={saveDraft} disabled={sending} className="btn-secondary flex-1 justify-center">
                Save Draft
              </button>
              <button onClick={sendCampaign} disabled={sending} className="btn-primary flex-1 justify-center">
                {sending ? 'Saving…' : `Send to ${activeCount} subscribers`}
              </button>
            </div>
            <p className="text-xs text-ink-400">
              Note: Connect Resend or Mailgun API to send actual emails. Currently saves campaigns to database.
            </p>
          </div>

          {/* Preview */}
          <div className="card p-5">
            <h3 className="font-semibold text-ink-900 mb-4">Preview</h3>
            <div className="bg-surface-2 rounded-xl p-4 border border-ink-100">
              <div className="border-b border-ink-100 pb-3 mb-3">
                <p className="text-xs text-ink-400">Subject</p>
                <p className="font-semibold text-ink-900">{subject || 'Your subject line here'}</p>
                {preview && <p className="text-xs text-ink-400 mt-0.5">{preview}</p>}
              </div>
              <div className="prose prose-sm max-w-none text-ink-700 min-h-32"
                dangerouslySetInnerHTML={{ __html: body || '<p class="text-ink-300">Email content will appear here…</p>' }} />
            </div>
          </div>
        </div>
      )}

      {/* SUBSCRIBERS */}
      {tab === 'subscribers' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-ink-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide">
              {subscribers.length} Subscribers · {activeCount} Active
            </p>
            <button onClick={exportCSV} className="btn-secondary btn-sm">Export CSV</button>
          </div>
          <div className="divide-y divide-ink-50">
            {subscribers.length === 0 && (
              <p className="p-8 text-center text-sm text-ink-300">
                No subscribers yet. Add a newsletter signup form to your site.
              </p>
            )}
            {subscribers.map(s => (
              <div key={s.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-900">{s.email}</p>
                  <p className="text-xs text-ink-400">{s.name || 'No name'} · {formatDate(s.subscribed_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge ${s.is_active ? 'badge-published' : 'badge-archived'}`}>
                    {s.is_active ? 'Active' : 'Unsubscribed'}
                  </span>
                  <button onClick={() => toggleSubscriber(s.id, s.is_active)}
                    className="text-xs text-ink-400 hover:text-accent transition-colors">
                    {s.is_active ? 'Unsubscribe' : 'Reactivate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CAMPAIGNS */}
      {tab === 'campaigns' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-ink-100">
            <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide">{campaigns.length} Campaigns</p>
          </div>
          <div className="divide-y divide-ink-50">
            {campaigns.length === 0 && (
              <p className="p-8 text-center text-sm text-ink-300">No campaigns yet. Compose your first newsletter.</p>
            )}
            {campaigns.map(c => (
              <div key={c.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{c.subject}</p>
                  <p className="text-xs text-ink-400 mt-0.5">
                    {formatDate(c.created_at)} · {c.sent_count} recipients
                  </p>
                </div>
                <span className={`badge ${c.status === 'sent' ? 'badge-published' : 'badge-draft'}`}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
