'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

interface EnrichedData {
  seo_title: string
  meta_description: string
  focus_keyword: string
  secondary_keywords: string[]
  slug: string
  excerpt: string
  discover_headline: string
  discover_tags: string[]
  readability_score: number
  readability_tips: string[]
  word_count: number
  estimated_read_time: string
}

export function PasteEnrich() {
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [enriched, setEnriched] = useState<EnrichedData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedArticleId, setSavedArticleId] = useState<string | null>(null)
  const [showPublisher, setShowPublisher] = useState(false)

  // WordPress publish state
  const [wpUrl, setWpUrl] = useState('')
  const [wpUser, setWpUser] = useState('')
  const [wpPass, setWpPass] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishLog, setPublishLog] = useState<{text: string; type: string}[]>([])
  const [wpLink, setWpLink] = useState('')

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length

  async function enrichContent() {
    if (!content.trim()) { toast.error('Paste your article first'); return }
    if (!title.trim()) { toast.error('Add a title'); return }
    setLoading(true)
    setEnriched(null)

    try {
      const res = await fetch('/api/ai/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, category }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Enrichment failed')
      setEnriched(data)
      toast.success('SEO metadata generated!')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function saveAsDraft() {
    if (!enriched) return
    setSaving(true)
    try {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: enriched.seo_title || title,
          content,
          excerpt: enriched.excerpt,
          slug: enriched.slug,
          seo_title: enriched.seo_title,
          meta_description: enriched.meta_description,
          focus_keyword: enriched.focus_keyword,
          status: 'draft',
          ai_generated: false,
          category_name: category,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSavedArticleId(data.id)
      toast.success('Saved as draft!')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function addLog(text: string, type: string) {
    setPublishLog(prev => [...prev, { text, type }])
  }

  async function publishToWordPress() {
    if (!savedArticleId) { toast.error('Save as draft first'); return }
    if (!wpUrl || !wpUser || !wpPass) { toast.error('Fill in WordPress credentials'); return }

    setPublishing(true)
    setPublishLog([])
    setWpLink('')

    const finalUrl = wpUrl.replace(/\/$/, '')

    // Fetch image
    addLog('Searching for featured image...', 'info')
    let wpMediaId = null
    try {
      const imgRes = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, wp_url: finalUrl, wp_username: wpUser, wp_password: wpPass }),
      })
      const imgData = await imgRes.json()
      if (imgData.success) {
        wpMediaId = imgData.wp_media_id
        addLog(`Photo found: "${imgData.search_query}" by ${imgData.photographer}`, 'success')
      } else {
        addLog(`Image: ${imgData.error} — publishing without image`, 'warn')
      }
    } catch { addLog('Image fetch failed — continuing', 'warn') }

    // Push to WordPress
    addLog('Checking for duplicates...', 'info')
    try {
      const res = await fetch('/api/wordpress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: savedArticleId,
          wp_url: finalUrl,
          wp_username: wpUser,
          wp_password: wpPass,
          featured_media: wpMediaId,
        }),
      })
      const data = await res.json()
      if (res.status === 409) {
        addLog('Duplicate detected — article already exists', 'error')
        return
      }
      if (!res.ok) throw new Error(data.error || 'Publish failed')
      setWpLink(data.wp_url)
      addLog('Published successfully!', 'success')
      addLog(`Live at: ${data.wp_url}`, 'success')
    } catch (e) {
      addLog(`Error: ${(e as Error).message}`, 'error')
    } finally {
      setPublishing(false)
    }
  }

  const logColors: Record<string, string> = {
    info: 'text-ink-400', success: 'text-green-500',
    error: 'text-red-500', warn: 'text-amber-500'
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="font-display text-xl font-bold text-ink-950">📋 Paste & Enrich</h2>
        <p className="text-sm text-ink-400 mt-1">Paste your article → AI generates SEO metadata → push to WordPress</p>
      </div>

      {/* Input section */}
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-ink-900 text-sm">Article Content</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Article Title *</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Enter the article title..." />
          </div>
          <div>
            <label className="label">Category</label>
            <input className="input" value={category} onChange={e => setCategory(e.target.value)}
              placeholder="Politics, Sports, Technology..." />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label">Paste Article Content *</label>
            <span className="text-xs text-ink-400">{wordCount} words</span>
          </div>
          <textarea
            className="input resize-none font-sans text-sm leading-relaxed"
            rows={12}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Paste your article here (from WhatsApp, Word, email, anywhere)...&#10;&#10;The content will NOT be modified — only SEO metadata will be generated."
          />
          <p className="text-xs text-ink-400 mt-1">
            ✓ Your original content is preserved exactly as pasted
          </p>
        </div>
        <button onClick={enrichContent} disabled={loading || !content.trim() || !title.trim()}
          className="btn-primary">
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating SEO metadata...
            </span>
          ) : '✦ Generate SEO & Metadata'}
        </button>
      </div>

      {/* Enriched results */}
      {enriched && (
        <div className="space-y-4">
          {/* SEO scores */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{enriched.readability_score}/100</div>
              <div className="text-xs text-ink-400 mt-1">Readability Score</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{enriched.word_count}</div>
              <div className="text-xs text-ink-400 mt-1">Words</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-violet-600">{enriched.estimated_read_time}</div>
              <div className="text-xs text-ink-400 mt-1">Read Time</div>
            </div>
          </div>

          {/* SEO Metadata */}
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-ink-900 flex items-center gap-2">
              🔍 SEO Metadata
              <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Auto-generated</span>
            </h3>
            <div className="space-y-3">
              <div>
                <label className="label">SEO Title</label>
                <input className="input" value={enriched.seo_title}
                  onChange={e => setEnriched({...enriched, seo_title: e.target.value})} />
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-ink-400">Recommended: 50-60 characters</span>
                  <span className={enriched.seo_title.length > 60 ? 'text-red-500' : 'text-green-600'}>
                    {enriched.seo_title.length} chars
                  </span>
                </div>
              </div>
              <div>
                <label className="label">Meta Description</label>
                <textarea className="input resize-none" rows={2} value={enriched.meta_description}
                  onChange={e => setEnriched({...enriched, meta_description: e.target.value})} />
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-ink-400">Recommended: 150-160 characters</span>
                  <span className={enriched.meta_description.length > 160 ? 'text-red-500' : 'text-green-600'}>
                    {enriched.meta_description.length} chars
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Focus Keyword</label>
                  <input className="input" value={enriched.focus_keyword}
                    onChange={e => setEnriched({...enriched, focus_keyword: e.target.value})} />
                </div>
                <div>
                  <label className="label">URL Slug</label>
                  <input className="input font-mono text-xs" value={enriched.slug}
                    onChange={e => setEnriched({...enriched, slug: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="label">Excerpt</label>
                <textarea className="input resize-none" rows={2} value={enriched.excerpt}
                  onChange={e => setEnriched({...enriched, excerpt: e.target.value})} />
              </div>
            </div>
          </div>

          {/* Keywords */}
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-ink-900">🏷 Keywords & Tags</h3>
            <div>
              <label className="label">Secondary Keywords</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {enriched.secondary_keywords.map((kw, i) => (
                  <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Google Discover Tags</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {enriched.discover_tags.map((tag, i) => (
                  <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Google Discover */}
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-ink-900">🌐 Google Discover Optimization</h3>
            <div>
              <label className="label">Discover-Optimized Headline</label>
              <input className="input" value={enriched.discover_headline}
                onChange={e => setEnriched({...enriched, discover_headline: e.target.value})} />
              <p className="text-xs text-ink-400 mt-1">
                Use this as your article title for better Google Discover reach
              </p>
            </div>
            {enriched.readability_tips.length > 0 && (
              <div>
                <label className="label">Readability Tips</label>
                <div className="space-y-1 mt-1">
                  {enriched.readability_tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-ink-600">
                      <span className="text-amber-500 shrink-0">⚡</span>
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-ink-900">🚀 Publish</h3>
            <div className="flex gap-3 flex-wrap">
              <button onClick={saveAsDraft} disabled={saving}
                className="px-4 py-2 text-sm bg-ink-100 text-ink-700 rounded-xl hover:bg-ink-200 font-medium">
                {saving ? 'Saving...' : savedArticleId ? '✓ Saved as Draft' : '💾 Save as Draft'}
              </button>
              <button onClick={() => setShowPublisher(!showPublisher)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium">
                🚀 Push to WordPress
              </button>
            </div>

            {!savedArticleId && showPublisher && (
              <p className="text-xs text-amber-600">⚠ Save as draft first before publishing</p>
            )}

            {showPublisher && savedArticleId && (
              <div className="space-y-4 border-t border-ink-100 pt-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">WordPress URL</label>
                    <input className="input" value={wpUrl} onChange={e => setWpUrl(e.target.value)}
                      placeholder="https://yoursite.com" />
                  </div>
                  <div>
                    <label className="label">Username</label>
                    <input className="input" value={wpUser} onChange={e => setWpUser(e.target.value)}
                      placeholder="admin" />
                  </div>
                  <div>
                    <label className="label">Application Password</label>
                    <input className="input" type="password" value={wpPass}
                      onChange={e => setWpPass(e.target.value)} placeholder="xxxx xxxx xxxx xxxx" />
                  </div>
                </div>

                {publishLog.length > 0 && (
                  <div className="bg-ink-950 rounded-xl p-3 space-y-1 font-mono text-xs">
                    {publishLog.map((l, i) => (
                      <div key={i} className={logColors[l.type]}>
                        {l.type === 'success' ? '✓' : l.type === 'error' ? '✗' : l.type === 'warn' ? '⚠' : '›'} {l.text}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button onClick={publishToWordPress} disabled={publishing}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50">
                    {publishing ? 'Publishing...' : '🚀 Publish to WordPress'}
                  </button>
                  {wpLink && (
                    <a href={wpLink} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-blue-600 underline">
                      View live post →
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
