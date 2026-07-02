'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { SeoScoreCard } from '@/components/admin/SeoScoreCard'

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
  formatted_content?: string
  seo_grade?: 'A' | 'B' | 'C' | 'D' | 'F'
  seo_factors?: any[]
  category_name?: string
}

const LANGUAGES = [
  'English', 'Hindi', 'Kannada', 'Tamil', 'Telugu',
  'Malayalam', 'Marathi', 'Gujarati', 'Bengali', 'Punjabi',
]

export function PasteEnrich() {
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [enriched, setEnriched] = useState<EnrichedData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedArticleId, setSavedArticleId] = useState<string | null>(null)
  const [showPublisher, setShowPublisher] = useState(false)
  const [wpUrl, setWpUrl] = useState('')
  const [wpUser, setWpUser] = useState('')
  const [wpPass, setWpPass] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishLog, setPublishLog] = useState<{text: string; type: string}[]>([])
  const [wpLink, setWpLink] = useState('')

  // ── URL → Rewrite mode ──────────────────────────────────────────
  const [inputMode, setInputMode] = useState<'paste' | 'url'>('paste')
  const [sourceUrl, setSourceUrl] = useState('')
  const [targetLanguage, setTargetLanguage] = useState('English')
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [detectedLang, setDetectedLang] = useState('')
  const [rewrittenFromUrl, setRewrittenFromUrl] = useState(false)

  const [subheadings, setSubheadings] = useState<any[]>([])
  const [injectedContent, setInjectedContent] = useState<string | null>(null)
  const [subheadingsApplied, setSubheadingsApplied] = useState(false)
  const [subLoading, setSubLoading] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length

  // ── Pre-fill WordPress credentials from saved site ──────────────
  useEffect(() => {
    async function loadSavedSite() {
      try {
        const res = await fetch('/api/sites/my-site')
        if (res.ok) {
          const data = await res.json()
          if (data.site_url)        setWpUrl(data.site_url)
          if (data.wp_username)     setWpUser(data.wp_username)
          if (data.wp_app_password) setWpPass(data.wp_app_password)
        }
      } catch { /* silent — user can fill manually */ }
    }
    loadSavedSite()
  }, [])

  async function fetchAndRewrite() {
    if (!sourceUrl.trim()) { toast.error('Paste an article URL first'); return }
    setFetchingUrl(true)
    setDetectedLang('')
    setRewrittenFromUrl(false)
    try {
      const res = await fetch('/api/ai/rewrite-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sourceUrl, target_language: targetLanguage }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch and rewrite')
      setTitle(data.title || '')
      setContent(data.content || '')
      if (data.category) setCategory(data.category)
      setDetectedLang(data.detected_source_language || '')
      setRewrittenFromUrl(true)
      toast.success(`Rewritten in ${targetLanguage}! Source detected: ${data.detected_source_language}`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setFetchingUrl(false)
    }
  }

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
      // Auto-assign category if none was set
      if (data.category_name && !category) setCategory(data.category_name)
      toast.success(`SEO generated · Score: ${data.readability_score}/100 · Grade ${data.seo_grade || ''}`)
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
          content: enriched.formatted_content || content,
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

  function downloadTXT() {
    if (!enriched) return
    const text = [
      `TITLE\n${title}`,
      `SEO TITLE\n${enriched.seo_title}`,
      `META DESCRIPTION\n${enriched.meta_description}`,
      `FOCUS KEYWORD\n${enriched.focus_keyword}`,
      `SLUG\n${enriched.slug}`,
      `EXCERPT\n${enriched.excerpt}`,
      `DISCOVER HEADLINE\n${enriched.discover_headline}`,
      `SECONDARY KEYWORDS\n${enriched.secondary_keywords.join(', ')}`,
      `DISCOVER TAGS\n${enriched.discover_tags.map(t => '#' + t).join(' ')}`,
      `SEO SCORE\n${enriched.readability_score}/100 (Grade ${enriched.seo_grade || ''})`,
      `WORD COUNT\n${enriched.word_count} words · ${enriched.estimated_read_time}`,
      `CONTENT\n${enriched.formatted_content || content}`,
    ].join('\n\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${title.slice(0, 50).replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '-')}.txt`
    a.click()
    toast.success('Downloaded as TXT!')
  }

  function downloadHTML() {
    if (!enriched) return
    const kwSpans = enriched.secondary_keywords.map(k =>
      `<span style="background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:20px;font-size:12px;margin:2px;">${k}</span>`
    ).join(' ')
    const tagSpans = enriched.discover_tags.map(t =>
      `<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:20px;font-size:12px;margin:2px;">#${t}</span>`
    ).join(' ')
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${enriched.seo_title}</title>
<style>
body{font-family:Arial,sans-serif;max-width:820px;margin:40px auto;padding:24px;line-height:1.7;color:#1f2937}
h1{font-size:26px;color:#111;margin-bottom:8px}
table{width:100%;border-collapse:collapse;margin:20px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
th{background:#1f2937;color:#fff;padding:8px 12px;text-align:left;font-size:13px}
td{padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;vertical-align:top}
td:first-child{font-weight:600;color:#6b7280;width:180px}
.score{font-size:28px;font-weight:700;color:#16a34a}
.tip{background:#fef9ec;border-left:4px solid #ef4444;padding:12px 16px;margin:16px 0;font-size:13px;color:#92400e;border-radius:0 8px 8px 0}
.content{margin-top:28px;padding-top:20px;border-top:2px solid #e5e7eb}
.content h2{color:#374151;font-size:20px}
</style>
</head>
<body>
<h1>${title}</h1>
<div class="tip">📋 Copy the content below and paste into WordPress. Use the SEO Title and Meta Description in Yoast SEO. Score: <span class="score">${enriched.readability_score}/100 (${enriched.seo_grade || ''})</span></div>
<table>
<tr><th colspan="2">SEO & Metadata</th></tr>
<tr><td>SEO Title</td><td>${enriched.seo_title}</td></tr>
<tr><td>Meta Description</td><td>${enriched.meta_description}</td></tr>
<tr><td>Focus Keyword</td><td>${enriched.focus_keyword}</td></tr>
<tr><td>URL Slug</td><td><code>${enriched.slug}</code></td></tr>
<tr><td>Excerpt</td><td>${enriched.excerpt}</td></tr>
<tr><td>Discover Headline</td><td><strong>${enriched.discover_headline}</strong></td></tr>
<tr><td>Word Count</td><td>${enriched.word_count} words · ${enriched.estimated_read_time}</td></tr>
<tr><td>Secondary Keywords</td><td>${kwSpans}</td></tr>
<tr><td>Discover Tags</td><td>${tagSpans}</td></tr>
</table>
<div class="content">
<h2>Article Content</h2>
${enriched.formatted_content || content.replace(/\n/g, '<br>')}
</div>
</body>
</html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${title.slice(0, 50).replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '-')}.html`
    a.click()
    toast.success('HTML downloaded — open in browser and copy into WordPress!')
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
    addLog('Generating AI featured image...', 'info')
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
        addLog(`Image ready (ID: ${imgData.wp_media_id})`, 'success')
      } else {
        addLog(`Image: ${imgData.error} — publishing without image`, 'warn')
      }
    } catch { addLog('Image generation failed — continuing', 'warn') }
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
      if (res.status === 409) { addLog('Duplicate detected — article already exists', 'error'); return }
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

  async function generateSubheadings() {
    if (!content.trim()) return
    setSubLoading(true)
    setSubheadings([])
    try {
      const res = await fetch('/api/ai/subheadings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, title }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setSubheadings(data.subheadings || [])
      if (data.injected_content) {
        setInjectedContent(data.injected_content)
        setSubheadingsApplied(false)
      }
      toast.success(`${data.subheadings?.length} subheadings ready to inject!`)
    } catch (e) {
      toast.error((e as Error).message)
    }
    setSubLoading(false)
  }

  function copySubheading(text: string, idx: number) {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
    toast.success('Copied!')
  }

  const logColors: Record<string, string> = {
    info: 'text-ink-400', success: 'text-green-500',
    error: 'text-red-500', warn: 'text-amber-500'
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="font-display text-xl font-bold text-ink-950">📋 Paste & Enrich</h2>
        <p className="text-sm text-ink-400 mt-1">Paste your article or a source URL → AI generates SEO metadata → push to WordPress</p>
      </div>

      <div className="card p-5 space-y-4">
        {/* Mode toggle */}
        <div className="flex gap-1 p-1 bg-ink-100 rounded-xl w-fit">
          {[
            { k: 'paste', l: '📋 Paste Text' },
            { k: 'url', l: '🔗 Paste URL' },
          ].map(opt => (
            <button key={opt.k} onClick={() => setInputMode(opt.k as 'paste' | 'url')}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${inputMode === opt.k ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
              {opt.l}
            </button>
          ))}
        </div>

        {/* URL mode panel */}
        {inputMode === 'url' && (
          <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl space-y-3">
            <p className="text-xs font-semibold text-violet-900">🔗 Generate from another article's URL</p>
            <p className="text-xs text-violet-600">
              Paste any article URL — the system fetches it, detects the source language, and writes a completely original, plagiarism-free version in your chosen language.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="label">Source Article URL</label>
                <input className="input" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}
                  placeholder="https://example.com/news/some-article" />
              </div>
              <div>
                <label className="label">Write In</label>
                <select className="input" value={targetLanguage} onChange={e => setTargetLanguage(e.target.value)}>
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <button onClick={fetchAndRewrite} disabled={fetchingUrl || !sourceUrl.trim()}
              className="btn-primary text-sm">
              {fetchingUrl ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Fetching & rewriting...
                </span>
              ) : '✦ Fetch & Rewrite Original Article'}
            </button>
            {rewrittenFromUrl && detectedLang && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                ✓ Source language detected: <strong>{detectedLang}</strong> · Rewritten in: <strong>{targetLanguage}</strong> · Review the title and content below before generating SEO metadata.
              </p>
            )}
          </div>
        )}

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
            <label className="label">{inputMode === 'url' ? 'Rewritten Article Content *' : 'Paste Article Content *'}</label>
            <span className="text-xs text-ink-400">{wordCount} words</span>
          </div>
          <textarea
            className="input resize-none font-sans text-sm leading-relaxed"
            rows={12}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={inputMode === 'url'
              ? 'Fetch a URL above to generate original content here, or switch to Paste Text...'
              : 'Paste your article here (from WhatsApp, Word, email, anywhere)...'}
          />
          <p className="text-xs text-ink-400 mt-1">
            {inputMode === 'url'
              ? '✓ This is an original rewrite, not a copy — review and edit before publishing'
              : '✓ Your original content is preserved exactly as pasted'}
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

      {enriched && (
        <div className="space-y-4">

          {/* ── SEO Score + Stats ── */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <SeoScoreCard score={{
                total: enriched.readability_score,
                grade: enriched.seo_grade || 'C',
                factors: enriched.seo_factors || [],
                tips: enriched.readability_tips || [],
              }} />
            </div>
            <div className="space-y-3">
              <div className="card p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{enriched.word_count}</div>
                <div className="text-xs text-ink-400 mt-1">Words</div>
              </div>
              <div className="card p-4 text-center">
                <div className="text-2xl font-bold text-violet-600">{enriched.estimated_read_time}</div>
                <div className="text-xs text-ink-400 mt-1">Read Time</div>
              </div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold text-ink-900 flex items-center gap-2">
                🔍 SEO Metadata
                <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Auto-generated</span>
              </h3>
              <div className="flex gap-2">
                <button onClick={downloadTXT}
                  className="text-xs px-3 py-1.5 bg-ink-100 text-ink-700 rounded-lg hover:bg-ink-200"
                  title="Download as plain text">
                  ⬇ TXT
                </button>
                <button onClick={downloadHTML}
                  className="text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100"
                  title="Download as HTML">
                  ⬇ HTML
                </button>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-700">
                <span className="font-semibold">Can't publish directly?</span> Download as <button onClick={downloadHTML} className="underline font-semibold">HTML</button> → open in browser → copy content → paste into WordPress editor.
              </p>
            </div>

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
                  <span className={enriched.meta_description.length > 160 ? 'text-red-500' : enriched.meta_description.length >= 150 ? 'text-green-600' : 'text-amber-500'}>
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
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-ink-400">Recommended: 80-120 characters</span>
                  <span className={enriched.excerpt.length >= 80 ? 'text-green-600' : 'text-amber-500'}>
                    {enriched.excerpt.length} chars
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-ink-900">🏷 Keywords & Tags</h3>
            <div>
              <label className="label">Secondary Keywords</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {enriched.secondary_keywords.map((kw, i) => (
                  <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">{kw}</span>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Google Discover Tags</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {enriched.discover_tags.map((tag, i) => (
                  <span key={i} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg">#{tag}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-ink-900">🌐 Google Discover Optimization</h3>
            <div>
              <label className="label">Discover-Optimized Headline</label>
              <input className="input" value={enriched.discover_headline}
                onChange={e => setEnriched({...enriched, discover_headline: e.target.value})} />
              <p className="text-xs text-ink-400 mt-1">Use this as your article title for better Google Discover reach</p>
            </div>
          </div>

          {/* Subheadings */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-semibold text-ink-900">📑 Subheadings</h3>
                <p className="text-xs text-ink-400 mt-0.5">AI suggests H2 subheadings — your content stays unchanged</p>
              </div>
              <button onClick={generateSubheadings} disabled={subLoading}
                className="text-xs px-4 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 font-medium">
                {subLoading ? '⟳ Generating...' : '✦ Generate Subheadings'}
              </button>
            </div>
            {subheadings.length > 0 && (
              <div className="space-y-3">
                <div className="space-y-2">
                  {subheadings.map((sh: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-ink-50 border border-ink-100 rounded-xl">
                      <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center shrink-0">H2</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink-900">{sh.subheading}</p>
                        <p className="text-xs text-ink-400">Before paragraph {sh.before_paragraph}{sh.preview && ` — "${sh.preview}"`}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {!subheadingsApplied ? (
                  <div className="flex items-center gap-3 p-4 bg-violet-50 border border-violet-200 rounded-xl">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-violet-900">Ready to inject {subheadings.length} subheadings</p>
                      <p className="text-xs text-violet-600 mt-0.5">Subheadings will be inserted into your content.</p>
                    </div>
                    <button
                      onClick={() => {
                        if (injectedContent) {
                          setContent(injectedContent)
                          setSubheadingsApplied(true)
                          toast.success('Subheadings injected!')
                        }
                      }}
                      className="text-xs px-4 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-700 font-semibold shrink-0">
                      ✦ Inject into Content
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                    <span className="text-green-600 font-bold">✓</span>
                    <p className="text-sm text-green-700 font-medium">Subheadings injected!</p>
                    <button onClick={() => { setSubheadingsApplied(false); setSubheadings([]) }}
                      className="ml-auto text-xs text-green-600 hover:underline">Undo</button>
                  </div>
                )}
              </div>
            )}
            {subheadings.length === 0 && !subLoading && (
              <p className="text-xs text-ink-400">Click "Generate Subheadings" to get AI-suggested H2 headings</p>
            )}
          </div>

          {/* Publish */}
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
                    <label className="label flex items-center justify-between">
                      WordPress URL
                      {wpUrl && <span className="text-[10px] text-green-600 font-medium">✓ Saved</span>}
                    </label>
                    <input className="input" value={wpUrl} onChange={e => setWpUrl(e.target.value)}
                      placeholder="https://yoursite.com" />
                  </div>
                  <div>
                    <label className="label flex items-center justify-between">
                      Username
                      {wpUser && <span className="text-[10px] text-green-600 font-medium">✓ Saved</span>}
                    </label>
                    <input className="input" value={wpUser} onChange={e => setWpUser(e.target.value)}
                      placeholder="admin" />
                  </div>
                  <div>
                    <label className="label flex items-center justify-between">
                      App Password
                      {wpPass && <span className="text-[10px] text-green-600 font-medium">✓ Saved</span>}
                    </label>
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
                      className="text-sm text-blue-600 underline">View live post →</a>
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
