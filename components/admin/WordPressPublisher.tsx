'use client'
import { useState } from 'react'

interface Article { id: string; title: string; status: string }
interface Props { articles: Article[] }

export function WordPressPublisher({ articles }: Props) {
  const [selectedId, setSelectedId] = useState('')
  const [wpUrl, setWpUrl] = useState('https://trendingverse.online')
  const [wpUser, setWpUser] = useState('')
  const [wpPass, setWpPass] = useState('')
  const [status, setStatus] = useState<'idle' | 'pushing' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [wpLink, setWpLink] = useState('')
  const [open, setOpen] = useState(false)

  async function push() {
    if (!selectedId) return alert('Please select an article')
    if (!wpUrl || !wpUser || !wpPass) return alert('Please fill in WordPress credentials')
    setStatus('pushing')
    setMessage('Pushing to WordPress...')
    try {
      const res = await fetch('/api/wordpress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: selectedId, wp_url: wpUrl, wp_username: wpUser, wp_password: wpPass }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Push failed')
      setStatus('success')
      setWpLink(data.wp_url)
      setMessage(`✅ Published! Post ID: ${data.wp_post_id}`)
    } catch (e) {
      setStatus('error')
      setMessage(`❌ ${(e as Error).message}`)
    }
  }

  return (
    <div className="card p-5 border border-blue-100 bg-blue-50/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">⬆</span>
          <div>
            <h2 className="font-semibold text-ink-900 text-sm">Push to WordPress</h2>
            <p className="text-xs text-ink-400">Publish articles directly to trendingverse.online</p>
          </div>
        </div>
        <button onClick={() => setOpen(!open)}
          className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
          {open ? 'Close' : 'Open Publisher'}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-500 block mb-1">SELECT ARTICLE</label>
            <select className="input w-full" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
              <option value="">-- Choose an article --</option>
              {articles.map(a => (
                <option key={a.id} value={a.id}>{a.title} [{a.status}]</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-ink-500 block mb-1">WORDPRESS URL</label>
              <input className="input w-full" value={wpUrl} onChange={e => setWpUrl(e.target.value)}
                placeholder="https://trendingverse.online" />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-500 block mb-1">USERNAME</label>
              <input className="input w-full" value={wpUser} onChange={e => setWpUser(e.target.value)}
                placeholder="admin" />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-500 block mb-1">APPLICATION PASSWORD</label>
              <input className="input w-full" type="password" value={wpPass} onChange={e => setWpPass(e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={push} disabled={status === 'pushing'}
              className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {status === 'pushing' ? '⟳ Publishing...' : '⬆ Publish to WordPress'}
            </button>
            {message && (
              <span className={`text-sm ${status === 'success' ? 'text-green-600' : status === 'error' ? 'text-red-500' : 'text-ink-400'}`}>
                {message}
                {wpLink && <a href={wpLink} target="_blank" rel="noopener noreferrer" className="ml-2 underline">View post →</a>}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
