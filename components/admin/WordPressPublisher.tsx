'use client'
import { useState } from 'react'

interface Article { id: string; title: string; content?: string; status: string }
interface Props { articles: Article[] }

export function WordPressPublisher({ articles }: Props) {
  const [selectedId, setSelectedId] = useState('')
  const [wpUrl, setWpUrl] = useState('https://trendingverse.online')
  const [wpUser, setWpUser] = useState('')
  const [wpPass, setWpPass] = useState('')
  const [genImage, setGenImage] = useState(true)
  const [status, setStatus] = useState<'idle' | 'generating' | 'pushing' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [wpLink, setWpLink] = useState('')
  const [previewImg, setPreviewImg] = useState('')
  const [open, setOpen] = useState(false)

  const selectedArticle = articles.find(a => a.id === selectedId)

  async function publish() {
    if (!selectedId) return alert('Please select an article')
    if (!wpUrl || !wpUser || !wpPass) return alert('Please fill in WordPress credentials')

    let wpMediaId: number | null = null

    if (genImage) {
      setStatus('generating')
      setMessage('Generating editorial image with AI...')
      try {
        const imgRes = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: selectedArticle?.title || '',
            content: selectedArticle?.content || '',
            article_id: selectedId,
            wp_url: wpUrl,
            wp_username: wpUser,
            wp_password: wpPass,
          }),
        })
        const imgData = await imgRes.json()
        if (imgData.success) {
          wpMediaId = imgData.wp_media_id
          setPreviewImg('data:image/jpeg;base64,' + imgData.image_b64)
          setMessage('Image generated and uploaded to WordPress (ID: ' + wpMediaId + ')')
        } else {
          setMessage('Image generation failed: ' + imgData.error + ' - continuing without image...')
        }
      } catch (e) {
        setMessage('Image error: ' + (e as Error).message + ' - continuing without image...')
      }
      await new Promise(r => setTimeout(r, 1000))
    }

    setStatus('pushing')
    setMessage('Publishing article to WordPress...')
    try {
      const res = await fetch('/api/wordpress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: selectedId,
          wp_url: wpUrl,
          wp_username: wpUser,
          wp_password: wpPass,
          featured_media: wpMediaId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Push failed')
      setStatus('success')
      setWpLink(data.wp_url)
      setMessage('Published successfully!')
    } catch (e) {
      setStatus('error')
      setMessage((e as Error).message)
    }
  }

  return (
    <div className="card p-5 border border-blue-100 bg-blue-50/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚀</span>
          <div>
            <h2 className="font-semibold text-ink-900">Push to WordPress</h2>
            <p className="text-xs text-ink-400">Generate image + publish article to trendingverse.online</p>
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
              <input className="input w-full" value={wpUrl} onChange={e => setWpUrl(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-500 block mb-1">USERNAME</label>
              <input className="input w-full" value={wpUser} onChange={e => setWpUser(e.target.value)} placeholder="admin" />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-500 block mb-1">APPLICATION PASSWORD</label>
              <input className="input w-full" type="password" value={wpPass} onChange={e => setWpPass(e.target.value)} placeholder="xxxx xxxx xxxx xxxx" />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-ink-100">
            <input type="checkbox" id="gen_img" checked={genImage} onChange={e => setGenImage(e.target.checked)} className="w-4 h-4 accent-blue-600" />
            <label htmlFor="gen_img" className="text-sm font-medium text-ink-700 cursor-pointer">Auto-generate editorial featured image with AI (Imagen 4)</label>
          </div>

          {previewImg && (
            <div className="rounded-xl overflow-hidden border border-ink-100">
              <img src={previewImg} alt="Generated featured image" className="w-full h-48 object-cover" />
              <p className="text-xs text-ink-400 p-2">Image generated and uploaded to WordPress</p>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button onClick={publish} disabled={status === 'generating' || status === 'pushing'}
              className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {status === 'generating' ? 'Generating image...' : status === 'pushing' ? 'Publishing...' : 'Generate Image & Publish'}
            </button>
            {message && (
              <div className={`text-sm ${status === 'success' ? 'text-green-600' : status === 'error' ? 'text-red-500' : 'text-ink-500'}`}>
                {message}
                {wpLink && <a href={wpLink} target="_blank" rel="noopener noreferrer" className="ml-2 underline text-blue-600">View on site</a>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
