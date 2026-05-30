'use client'
import { useState } from 'react'

interface Article { id: string; title: string; content?: string; status: string }
interface Props { articles: Article[] }

export function WordPressPublisher({ articles }: Props) {
  const [selectedId, setSelectedId] = useState('')
  const [wpUrl, setWpUrl] = useState('')
  const [wpUser, setWpUser] = useState('')
  const [wpPass, setWpPass] = useState('')
  const [autoImage, setAutoImage] = useState(true)
  const [status, setStatus] = useState<'idle'|'image'|'pushing'|'success'|'error'>('idle')
  const [log, setLog] = useState<{text: string; type: 'info'|'success'|'error'|'warn'}[]>([])
  const [previewImg, setPreviewImg] = useState('')
  const [wpLink, setWpLink] = useState('')
  const [open, setOpen] = useState(false)

  const selectedArticle = articles.find(a => a.id === selectedId)

  function addLog(text: string, type: 'info'|'success'|'error'|'warn' = 'info') {
    setLog(prev => [...prev, { text, type }])
  }

  async function publish() {
    if (!selectedId) return alert('Please select an article')
    if (!wpUrl || !wpUser || !wpPass) return alert('Please fill in WordPress credentials')

    // Normalize URL — force HTTPS, remove trailing slash
    const finalUrl = wpUrl
      .replace(/^http:\/\//i, 'https://')
      .replace(/\/$/, '')
    setWpUrl(finalUrl)

    setLog([])
    setPreviewImg('')
    setWpLink('')

    let wpMediaId: number | null = null

    // Step 1: Fetch image from Pexels
    if (autoImage) {
      setStatus('image')
      addLog('Searching for editorial photo on Pexels...', 'info')
      try {
        const imgRes = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: selectedArticle?.title || '',
            content: selectedArticle?.content || '',
            article_id: selectedId,
            wp_url: finalUrl,
            wp_username: wpUser,
            wp_password: wpPass,
          }),
        })
        const imgData = await imgRes.json()
        if (imgData.success) {
          wpMediaId = imgData.wp_media_id
          setPreviewImg(imgData.image_url)
          addLog(`Photo found: "${imgData.search_query}" by ${imgData.photographer}`, 'success')
          addLog(`Uploaded to WordPress media library (ID: ${wpMediaId})`, 'success')
        } else {
          addLog(`Image: ${imgData.error} — publishing without featured image`, 'warn')
        }
      } catch (e) {
        addLog(`Image error: ${(e as Error).message} — continuing without image`, 'warn')
      }
    }

    // Step 2: Push article
    setStatus('pushing')
    addLog('Checking for duplicates on WordPress...', 'info')
    try {
      const res = await fetch('/api/wordpress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: selectedId,
          wp_url: finalUrl,
          wp_username: wpUser,
          wp_password: wpPass,
          featured_media: wpMediaId,
        }),
      })
      const data = await res.json()

      if (res.status === 409) {
        setStatus('error')
        addLog(`Duplicate detected! This article already exists on WordPress.`, 'error')
        addLog(`Existing post: ${data.existing_url}`, 'warn')
        return
      }

      if (!res.ok) throw new Error(data.error || 'Push failed')

      setStatus('success')
      setWpLink(data.wp_url)
      addLog(`Article published successfully!`, 'success')
      addLog(`Live at: ${data.wp_url}`, 'success')
    } catch (e) {
      setStatus('error')
      addLog(`Error: ${(e as Error).message}`, 'error')
    }
  }

  const logColors = { info: 'text-ink-500', success: 'text-green-600', error: 'text-red-500', warn: 'text-amber-500' }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚀</span>
          <div>
            <h2 className="font-semibold text-ink-900">Push to WordPress</h2>
            <p className="text-xs text-ink-400">Auto-fetch photo + publish to your WordPress site with duplicate protection</p>
          </div>
        </div>
        <button onClick={() => setOpen(!open)}
          className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
          {open ? 'Close' : 'Open Publisher'}
        </button>
      </div>

      {open && (
        <div className="mt-5 space-y-4">
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
              <input className="input w-full" value={wpUrl}
                onChange={e => setWpUrl(e.target.value)}
                placeholder="https://yoursite.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-500 block mb-1">USERNAME</label>
              <input className="input w-full" value={wpUser}
                onChange={e => setWpUser(e.target.value)} placeholder="admin" />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-500 block mb-1">APPLICATION PASSWORD</label>
              <input className="input w-full" type="password" value={wpPass}
                onChange={e => setWpPass(e.target.value)} placeholder="xxxx xxxx xxxx xxxx" />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-ink-50 rounded-xl">
            <input type="checkbox" id="auto_img" checked={autoImage}
              onChange={e => setAutoImage(e.target.checked)} className="w-4 h-4 accent-blue-600" />
            <label htmlFor="auto_img" className="text-sm text-ink-700 cursor-pointer">
              Auto-fetch relevant editorial photo from Pexels (free)
            </label>
          </div>

          {previewImg && (
            <div className="rounded-xl overflow-hidden border border-ink-100">
              <img src={previewImg} alt="Featured" className="w-full h-44 object-cover" />
            </div>
          )}

          {log.length > 0 && (
            <div className="bg-ink-950 rounded-xl p-3 space-y-1 font-mono text-xs">
              {log.map((l, i) => (
                <div key={i} className={logColors[l.type]}>
                  {l.type === 'success' ? '✓' : l.type === 'error' ? '✗' : l.type === 'warn' ? '⚠' : '›'} {l.text}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={publish}
              disabled={status === 'image' || status === 'pushing'}
              className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {status === 'image' ? 'Fetching photo...' : status === 'pushing' ? 'Publishing...' : '🚀 Publish to WordPress'}
            </button>
            {wpLink && (
              <a href={wpLink} target="_blank" rel="noopener noreferrer"
                className="text-sm text-blue-600 underline font-medium">
                View live post →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
