'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface Suggestion {
  id: string; post_id: string
  discover_headline: string; seo_title: string
  meta_description: string; focus_keyword: string
  score_before: number; score_after: number
  status: 'pending' | 'approved' | 'rejected' | 'applied'
  created_at: string
}

const STATUS_COLORS = {
  pending:  'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  applied:  'bg-green-100 text-green-700',
}

export function SEORewriter() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading]         = useState(true)
  const [analyzing, setAnalyzing]     = useState(false)
  const [applying, setApplying]       = useState(false)
  const [filter, setFilter]           = useState<string>('all')
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editForm, setEditForm]       = useState<any>({})
  const [analyzeLimit, setAnalyzeLimit] = useState(20)
  const [stats, setStats]             = useState({ total: 0, pending: 0, approved: 0, applied: 0, rejected: 0 })

  useEffect(() => { loadSuggestions() }, [])

  async function loadSuggestions() {
    setLoading(true)
    const res = await fetch('/api/admin/seo-rewrite?action=status')
    if (res.ok) {
      const data: Suggestion[] = await res.json()
      setSuggestions(data)
      setStats({
        total:    data.length,
        pending:  data.filter(d => d.status === 'pending').length,
        approved: data.filter(d => d.status === 'approved').length,
        applied:  data.filter(d => d.status === 'applied').length,
        rejected: data.filter(d => d.status === 'rejected').length,
      })
    }
    setLoading(false)
  }

 async function runAnalysis() {
    setAnalyzing(true)
    const BATCH = 5
    const total = analyzeLimit
    let totalSaved = 0
    let totalAnalyzed = 0

    for (let offset = 0; offset < total; offset += BATCH) {
      const limit = Math.min(BATCH, total - offset)
      toast.loading(`Analyzing articles ${offset + 1}–${offset + limit} of ${total}...`, { id: 'analyze' })
      try {
        const res = await fetch(`/api/admin/seo-rewrite?action=analyze&limit=${limit}&offset=${offset}`)
        const data = await res.json()
        if (data.analyzed) totalAnalyzed += data.analyzed
        if (data.saved) totalSaved += data.saved
      } catch (e) {
        console.error('Batch failed at offset', offset)
      }
      // Wait 3s between batches
      if (offset + BATCH < total) await new Promise(r => setTimeout(r, 3000))
    }

    toast.dismiss('analyze')
    toast.success(`Done! ${totalAnalyzed} analyzed, ${totalSaved} saved`)
    setAnalyzing(false)
    loadSuggestions()
  }

  async function approveAll() {
    const pending = suggestions.filter(s => s.status === 'pending')
    for (const s of pending) {
      await fetch('/api/admin/seo-rewrite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: s.post_id, action: 'approve' }),
      })
    }
    toast.success(`${pending.length} suggestions approved`)
    loadSuggestions()
  }

  async function applyAll() {
    setApplying(true)
    toast.loading('Pushing to WordPress...', { id: 'apply' })
    const res = await fetch('/api/admin/seo-rewrite?action=apply&all=true')
    const data = await res.json()
    toast.dismiss('apply')
    if (res.ok) toast.success(`${data.applied} headlines updated in WordPress!`)
    else toast.error('Apply failed')
    setApplying(false)
    loadSuggestions()
  }

  async function doAction(postId: string, action: string) {
    await fetch('/api/admin/seo-rewrite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, action }),
    })
    if (action === 'apply_single') toast.success('Applied to WordPress!')
    loadSuggestions()
  }

  async function saveEdit() {
    await fetch('/api/admin/seo-rewrite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, action: 'update' }),
    })
    toast.success('Saved & approved')
    setEditingId(null)
    loadSuggestions()
  }

  const filtered = filter === 'all' ? suggestions : suggestions.filter(s => s.status === filter)

  return (
    <div className="space-y-5">

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total',    value: stats.total,    color: 'text-ink-900' },
          { label: 'Pending',  value: stats.pending,  color: 'text-amber-600' },
          { label: 'Approved', value: stats.approved, color: 'text-blue-600' },
          { label: 'Applied',  value: stats.applied,  color: 'text-green-600' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-ink-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold text-ink-900 mb-1">🤖 AI Headline Rewriter</p>
            <p className="text-xs text-ink-400">Gemini analyzes each article and rewrites headlines for Google Discover + SEO</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-ink-500">Analyze</label>
              <select className="input text-xs w-24" value={analyzeLimit} onChange={e => setAnalyzeLimit(parseInt(e.target.value))}>
                <option value={10}>10 posts</option>
                <option value={20}>20 posts</option>
                <option value={50}>50 posts</option>
                <option value={100}>100 posts</option>
              </select>
            </div>
            <button onClick={runAnalysis} disabled={analyzing}
              className="btn-primary text-xs px-4 py-2 disabled:opacity-50">
              {analyzing ? '⟳ Analyzing...' : '✦ Run Analysis'}
            </button>
            {stats.pending > 0 && (
              <button onClick={approveAll}
                className="text-xs px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
                ✓ Approve All ({stats.pending})
              </button>
            )}
            {stats.approved > 0 && (
              <button onClick={applyAll} disabled={applying}
                className="text-xs px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50">
                {applying ? '⟳ Applying...' : `🚀 Push to WordPress (${stats.approved})`}
              </button>
            )}
          </div>
        </div>

        {/* How it works */}
        <div className="mt-4 grid grid-cols-4 gap-3">
          {[
            { num: '1', text: 'Run Analysis — Gemini reads each article' },
            { num: '2', text: 'Review suggestions — edit if needed' },
            { num: '3', text: 'Approve All — mark for publishing' },
            { num: '4', text: 'Push to WordPress — headlines go live' },
          ].map(s => (
            <div key={s.num} className="flex items-start gap-2 text-xs text-ink-500">
              <span className="w-5 h-5 rounded-full bg-accent/10 text-accent font-bold flex items-center justify-center shrink-0 text-[10px]">{s.num}</span>
              {s.text}
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-ink-100 rounded-xl w-fit">
        {['all', 'pending', 'approved', 'applied', 'rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${filter === f ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
            {f} {f !== 'all' ? `(${suggestions.filter(s => s.status === f).length})` : `(${suggestions.length})`}
          </button>
        ))}
      </div>

      {/* Suggestions table */}
      {loading ? (
        <div className="space-y-2">{Array(5).fill(0).map((_, i) => <div key={i} className="h-16 bg-ink-50 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-3xl mb-3">🔍</p>
          <p className="text-sm text-ink-500 mb-1">No suggestions yet</p>
          <p className="text-xs text-ink-400">Click "Run Analysis" to start optimizing your headlines</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => (
            <div key={s.id} className={`card p-4 ${s.status === 'applied' ? 'opacity-75' : ''}`}>
              {editingId === s.post_id ? (
                /* Edit mode */
                <div className="space-y-3">
                  <div>
                    <label className="label">Google Discover Headline</label>
                    <input className="input" value={editForm.discover_headline || ''}
                      onChange={e => setEditForm((f: any) => ({ ...f, discover_headline: e.target.value }))} />
                    <p className="text-xs text-ink-400 mt-1">{editForm.discover_headline?.length || 0} chars (ideal: 40-70)</p>
                  </div>
                  <div>
                    <label className="label">SEO Title</label>
                    <input className="input" value={editForm.seo_title || ''}
                      onChange={e => setEditForm((f: any) => ({ ...f, seo_title: e.target.value }))} />
                    <p className="text-xs text-ink-400 mt-1">{editForm.seo_title?.length || 0} chars (ideal: under 60)</p>
                  </div>
                  <div>
                    <label className="label">Meta Description</label>
                    <textarea className="input resize-none" rows={2} value={editForm.meta_description || ''}
                      onChange={e => setEditForm((f: any) => ({ ...f, meta_description: e.target.value }))} />
                    <p className="text-xs text-ink-400 mt-1">{editForm.meta_description?.length || 0} chars (ideal: 150-155)</p>
                  </div>
                  <div>
                    <label className="label">Focus Keyword</label>
                    <input className="input" value={editForm.focus_keyword || ''}
                      onChange={e => setEditForm((f: any) => ({ ...f, focus_keyword: e.target.value }))} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="btn-primary text-xs px-4 py-2">Save & Approve</button>
                    <button onClick={() => setEditingId(null)} className="text-xs px-4 py-2 bg-ink-100 text-ink-600 rounded-xl">Cancel</button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-ink-400">Post #{s.post_id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[s.status]}`}>{s.status}</span>
                      {s.score_before > 0 && (
                        <span className="text-xs text-ink-400">
                          SEO: <span className="text-red-500">{s.score_before}</span>
                          {' → '}
                          <span className="text-green-600 font-semibold">{s.score_after}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {s.status !== 'applied' && (
                        <>
                          <button onClick={() => { setEditingId(s.post_id); setEditForm({ post_id: s.post_id, discover_headline: s.discover_headline, seo_title: s.seo_title, meta_description: s.meta_description, focus_keyword: s.focus_keyword }) }}
                            className="text-xs px-2 py-1 bg-ink-100 text-ink-600 rounded-lg hover:bg-ink-200">✏ Edit</button>
                          {s.status === 'pending' && (
                            <button onClick={() => doAction(s.post_id, 'approve')}
                              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">✓ Approve</button>
                          )}
                          {s.status !== 'rejected' && (
                            <button onClick={() => doAction(s.post_id, 'reject')}
                              className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">✗ Reject</button>
                          )}
                          {(s.status === 'approved') && (
                            <button onClick={() => doAction(s.post_id, 'apply_single')}
                              className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">🚀 Apply</button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-ink-50 rounded-lg p-3">
                      <p className="text-[10px] font-semibold text-ink-400 uppercase mb-1.5">🔴 Google Discover Headline</p>
                      <p className="text-sm font-semibold text-ink-900 leading-snug">{s.discover_headline}</p>
                      <p className="text-[10px] text-ink-400 mt-1">{s.discover_headline?.length} chars</p>
                    </div>
                    <div className="bg-ink-50 rounded-lg p-3">
                      <p className="text-[10px] font-semibold text-ink-400 uppercase mb-1.5">🔵 SEO Title</p>
                      <p className="text-sm font-medium text-blue-700 leading-snug">{s.seo_title}</p>
                      <p className="text-[10px] text-ink-400 mt-1">{s.seo_title?.length} chars</p>
                    </div>
                    <div className="bg-ink-50 rounded-lg p-3 col-span-2">
                      <p className="text-[10px] font-semibold text-ink-400 uppercase mb-1.5">📝 Meta Description</p>
                      <p className="text-xs text-ink-600">{s.meta_description}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[10px] text-ink-400">{s.meta_description?.length} chars</p>
                        <p className="text-[10px] text-green-600 font-medium">🔑 {s.focus_keyword}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
