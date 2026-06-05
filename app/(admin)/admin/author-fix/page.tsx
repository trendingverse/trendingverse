'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

const USMAN_CATS = ['politics', 'business', 'finance', 'india', 'world', 'crime']
const AIZAL_CATS = ['technology', 'entertainment', 'sports', 'health', 'science', 'lifestyle', 'trending', 'education', 'environment']

interface WPUser { id: number; name: string; slug: string }

export default function AuthorFixPage() {
  const [users, setUsers]           = useState<WPUser[]>([])
  const [usmanId, setUsmanId]       = useState<number | null>(null)
  const [aizalId, setAizalId]       = useState<number | null>(null)
  const [loading, setLoading]       = useState(false)
  const [catProgress, setCatProgress] = useState(0)
  const [authProgress, setAuthProgress] = useState(0)
  const [catStats, setCatStats]     = useState({ updated: 0, failed: 0, batches: 0, total: 0 })
  const [authStats, setAuthStats]   = useState({ usman: 0, aizal: 0, failed: 0 })
  const [catLog, setCatLog]         = useState<string[]>([])
  const [authLog, setAuthLog]       = useState<string[]>([])
  const [catDone, setCatDone]       = useState(false)
  const TOTAL = 141

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    const res = await fetch('/api/admin/seo-fix-author?action=get_author')
    if (res.ok) setUsers(await res.json())
  }

  function addLog(logs: string[], setLogs: any, msg: string) {
    setLogs((prev: string[]) => [...prev, new Date().toLocaleTimeString() + '  ' + msg])
  }

  async function runRecategorize() {
    setLoading(true)
    setCatLog([])
    setCatProgress(0)
    setCatStats({ updated: 0, failed: 0, batches: 0, total: 0 })
    const BATCH = 10
    const batches = Math.ceil(TOTAL / BATCH)
    let updated = 0, failed = 0

    for (let i = 0; i < batches; i++) {
      const offset = i * BATCH
      const limit  = Math.min(BATCH, TOTAL - offset)
      addLog(catLog, setCatLog, `Batch ${i+1}/${batches}: articles ${offset+1}–${offset+limit}...`)
      try {
        const res  = await fetch(`/api/admin/seo-fix-author?action=recategorize&limit=${limit}&offset=${offset}`)
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        updated += data.updated || 0
        failed  += data.failed  || 0
        setCatStats({ updated, failed, batches: i+1, total: batches })
        setCatProgress(Math.round(((i+1)/batches)*100))
        addLog(catLog, setCatLog, `✓ ${data.updated} categorized → ${(data.categories_used||[]).join(', ')}`)
      } catch(e) {
        failed++
        addLog(catLog, setCatLog, `✗ Batch ${i+1}: ${(e as Error).message}`)
      }
      if (i < batches - 1) await new Promise(r => setTimeout(r, 3000))
    }

    addLog(catLog, setCatLog, `✅ Done! ${updated} articles recategorized`)
    setCatDone(true)
    setLoading(false)
    toast.success(`${updated} articles recategorized!`)
  }

  async function runAuthorFix() {
    if (!usmanId || !aizalId) { toast.error('Select both authors first'); return }
    setLoading(true)
    setAuthLog([])
    setAuthProgress(0)
    setAuthStats({ usman: 0, aizal: 0, failed: 0 })
    const BATCH = 20
    let usman = 0, aizal = 0, failed = 0

    for (let offset = 0; offset < TOTAL; offset += BATCH) {
      const limit = Math.min(BATCH, TOTAL - offset)
      addLog(authLog, setAuthLog, `Assigning articles ${offset+1}–${offset+limit}...`)
      try {
        const res  = await fetch(`/api/admin/seo-fix-author?action=fix_author_by_category&usman_id=${usmanId}&aizal_id=${aizalId}&limit=${limit}&offset=${offset}`)
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        usman  += data.usman  || 0
        aizal  += data.aizal  || 0
        failed += data.failed || 0
        setAuthStats({ usman, aizal, failed })
        setAuthProgress(Math.round(((offset+limit)/TOTAL)*100))
        addLog(authLog, setAuthLog, `✓ Usman:${data.usman} Aizal:${data.aizal}`)
      } catch(e) {
        addLog(authLog, setAuthLog, `✗ ${(e as Error).message}`)
      }
      if (offset + BATCH < TOTAL) await new Promise(r => setTimeout(r, 1500))
    }

    addLog(authLog, setAuthLog, `✅ Done! Usman:${usman} · Aizal:${aizal} articles`)
    setLoading(false)
    toast.success(`Authors assigned! Usman: ${usman}, Aizal: ${aizal}`)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">👤 Author & Category Fixer</h1>
        <p className="text-sm text-ink-400 mt-1">Step 1: Recategorize all articles with AI → Step 2: Auto-assign authors by category</p>
      </div>

      {/* Author split */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 border-l-4 border-red-500">
          <p className="text-xs font-bold text-red-500 mb-2 uppercase tracking-wide">Usman</p>
          <div className="flex flex-wrap gap-1">
            {['Politics','Business','Finance','India','World','Crime'].map(c => (
              <span key={c} className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">{c}</span>
            ))}
          </div>
        </div>
        <div className="card p-4 border-l-4 border-blue-500">
          <p className="text-xs font-bold text-blue-500 mb-2 uppercase tracking-wide">Aizal Wasira</p>
          <div className="flex flex-wrap gap-1">
            {['Technology','Entertainment','Sports','Health','Science','Lifestyle','Trending','Education','Environment'].map(c => (
              <span key={c} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Select authors */}
      <div className="card p-5">
        <h2 className="font-semibold text-ink-900 mb-3">Select Authors from WordPress</h2>
        {users.length === 0 ? (
          <p className="text-xs text-ink-400">Loading users...</p>
        ) : (
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-ink-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-ink-900">{u.name}</p>
                  <p className="text-xs text-ink-400">@{u.slug} · ID: {u.id}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setUsmanId(u.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${usmanId === u.id ? 'bg-red-500 text-white border-red-500' : 'border-ink-200 text-ink-600 hover:border-red-400'}`}>
                    = Usman
                  </button>
                  <button onClick={() => setAizalId(u.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${aizalId === u.id ? 'bg-blue-500 text-white border-blue-500' : 'border-ink-200 text-ink-600 hover:border-blue-400'}`}>
                    = Aizal
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {usmanId && aizalId && (
          <p className="text-xs text-green-600 bg-green-50 p-2 rounded-lg mt-3">
            ✓ Usman: ID {usmanId} · Aizal: ID {aizalId} — ready!
          </p>
        )}
      </div>

      {/* Step 1: Recategorize */}
      <div className="card p-5">
        <h2 className="font-semibold text-ink-900 mb-1">📂 Step 1 — Recategorize All Articles</h2>
        <p className="text-xs text-ink-400 mb-4">Gemini assigns correct Google News category to each article. Must run before Step 2.</p>
        <div className="grid grid-cols-4 gap-3 mb-3">
          {[
            { l: 'Categorized', v: catStats.updated, c: 'text-green-600' },
            { l: 'Failed',      v: catStats.failed,  c: 'text-red-500' },
            { l: 'Batch',       v: `${catStats.batches}/${catStats.total}`, c: 'text-blue-600' },
            { l: 'Progress',    v: `${catProgress}%`, c: 'text-amber-600' },
          ].map(s => (
            <div key={s.l} className="bg-ink-50 rounded-lg p-3 text-center">
              <p className={`text-xl font-bold ${s.c}`}>{s.v}</p>
              <p className="text-xs text-ink-400">{s.l}</p>
            </div>
          ))}
        </div>
        <div className="h-2 bg-ink-100 rounded-full mb-3">
          <div className="h-2 bg-blue-500 rounded-full transition-all" style={{ width: `${catProgress}%` }} />
        </div>
        <button onClick={runRecategorize} disabled={loading}
          className="btn-primary text-xs px-4 py-2 disabled:opacity-50">
          {loading && catProgress < 100 ? '⟳ Categorizing...' : '📂 Recategorize All 141 Articles'}
        </button>
        <div className="mt-3 bg-ink-50 rounded-lg p-3 h-36 overflow-y-auto font-mono text-xs space-y-0.5">
          {catLog.length === 0 && <p className="text-ink-300">Log will appear here...</p>}
          {catLog.map((l, i) => (
            <p key={i} className={l.includes('✅') || l.includes('✓') ? 'text-green-600' : l.includes('✗') ? 'text-red-500' : 'text-ink-500'}>{l}</p>
          ))}
        </div>
      </div>

      {/* Step 2: Author fix */}
      <div className="card p-5">
        <h2 className="font-semibold text-ink-900 mb-1">👤 Step 2 — Assign Authors by Category</h2>
        <p className="text-xs text-ink-400 mb-4">Auto-assigns Usman or Aizal based on each article's category. Run after Step 1.</p>
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[
            { l: '→ Usman',  v: authStats.usman,  c: 'text-red-500' },
            { l: '→ Aizal',  v: authStats.aizal,  c: 'text-blue-600' },
            { l: 'Failed',   v: authStats.failed, c: 'text-red-500' },
          ].map(s => (
            <div key={s.l} className="bg-ink-50 rounded-lg p-3 text-center">
              <p className={`text-xl font-bold ${s.c}`}>{s.v}</p>
              <p className="text-xs text-ink-400">{s.l}</p>
            </div>
          ))}
        </div>
        <div className="h-2 bg-ink-100 rounded-full mb-3">
          <div className="h-2 bg-red-500 rounded-full transition-all" style={{ width: `${authProgress}%` }} />
        </div>
        <button onClick={runAuthorFix} disabled={loading || !usmanId || !aizalId}
          className="btn-primary text-xs px-4 py-2 disabled:opacity-50">
          {loading && authProgress > 0 && authProgress < 100 ? '⟳ Assigning...' : '👤 Assign Authors by Category'}
        </button>
        {(!usmanId || !aizalId) && (
          <p className="text-xs text-amber-600 mt-2">Select both Usman and Aizal above first</p>
        )}
        <div className="mt-3 bg-ink-50 rounded-lg p-3 h-36 overflow-y-auto font-mono text-xs space-y-0.5">
          {authLog.length === 0 && <p className="text-ink-300">Log will appear here...</p>}
          {authLog.map((l, i) => (
            <p key={i} className={l.includes('✅') || l.includes('✓') ? 'text-green-600' : l.includes('✗') ? 'text-red-500' : 'text-ink-500'}>{l}</p>
          ))}
        </div>
      </div>
    </div>
  )
}
