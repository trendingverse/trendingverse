'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { Category } from '@/types'

const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिंदी' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
]

export function AIWriterPanel({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<'generate'|'headlines'|'trending'>('generate')
  const [loading, setLoading] = useState(false)

  // Generate
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [catId, setCatId] = useState('')
  const [kwInput, setKwInput] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [wordCount, setWordCount] = useState(700)
  const [tone, setTone] = useState('objective, journalistic')
  const [language, setLanguage] = useState('en')
  const [result, setResult] = useState<Record<string,unknown>|null>(null)

  // Headlines
  const [hlTopic, setHlTopic] = useState('')
  const [headlines, setHeadlines] = useState<string[]>([])

  // Trending
  const [region, setRegion] = useState('India')
  const [trending, setTrending] = useState<{title:string;summary:string;category:string;keywords:string[]}[]>([])

  function addKw() {
    const kw = kwInput.trim()
    if (kw && !keywords.includes(kw)) { setKeywords(k=>[...k,kw]); setKwInput('') }
  }

  async function generate() {
    if (!title && !topic) { toast.error('Enter a title or topic'); return }
    setLoading(true); setResult(null)
    try {
      const res = await fetch('/api/ai/generate', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ title: title||topic, keywords, category: categories.find(c=>c.id===catId)?.name, wordCount, tone, language }) })
const data = await res.json()
if (!res.ok) {
  if (data.error === 'FREE_PLAN_NO_KEY') {
    toast.error('Free plan: Add your Gemini API key in Settings → API Keys', { duration: 8000 })
    router.push('/admin/settings?tab=apikeys')
    return
  }
  throw new Error(data.message || data.error || 'Generation failed')
}
setResult(data)
toast.success(`Article generated!${data.model_used ? ` (${data.model_used})` : ''}`)
} catch(e) { toast.error((e as Error).message) }
    setLoading(false)
  }

  async function generateHeadlines() {
    if (!hlTopic) { toast.error('Enter a topic'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/ai/headlines', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ topic: hlTopic, count: 8 }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setHeadlines(data.headlines||[])
    } catch(e) { toast.error((e as Error).message) }
    setLoading(false)
  }

  async function fetchTrending() {
    setLoading(true)
    try {
      const res = await fetch(`/api/trending?region=${region}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTrending(data.topics||[])
    } catch(e) { toast.error((e as Error).message) }
    setLoading(false)
  }

  async function useGenerated() {
    if (!result) return
    const res = await fetch('/api/articles', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ...result, title: result.title, category_id: catId||null, status:'draft', ai_generated: true }) })
    const article = await res.json()
    if (res.ok) { toast.success('Saved as draft!'); router.push(`/admin/articles/${article.id}/edit`) }
    else toast.error(article.error)
  }

  const selectedLang = LANGUAGES.find(l => l.code === language)

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-ink-100 rounded-xl w-fit">
        {([['generate','✦ Generate Article'],['headlines','Headlines'],['trending','Trending Topics']] as const).map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab===t?'bg-white shadow text-ink-900':'text-ink-500 hover:text-ink-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* GENERATE */}
      {tab==='generate' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-ink-900">Article Generator</h3>

            <div>
              <label className="label">Title or Topic *</label>
              <input value={title} onChange={e=>setTitle(e.target.value)} className="input" placeholder="e.g. 'AI Revolution in Indian Healthcare 2025'"/>
            </div>

            <div>
              <label className="label">Category</label>
              <select value={catId} onChange={e=>setCatId(e.target.value)} className="input">
                <option value="">Select category…</option>
                {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Language Selector */}
            <div>
              <label className="label">Content Language</label>
              <div className="grid grid-cols-5 gap-1.5">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`flex flex-col items-center justify-center px-2 py-2 rounded-lg border text-center transition-all ${
                      language === lang.code
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-ink-100 hover:border-ink-300 text-ink-600'
                    }`}
                  >
                    <span className="text-xs font-medium leading-tight">{lang.native}</span>
                    <span className="text-[10px] text-ink-400 mt-0.5">{lang.name}</span>
                  </button>
                ))}
              </div>
              {language !== 'en' && (
                <p className="text-xs text-amber-600 mt-1.5 bg-amber-50 px-3 py-1.5 rounded-lg">
                  ✦ Article will be generated entirely in {selectedLang?.native} ({selectedLang?.name})
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Target Words</label>
                <select value={wordCount} onChange={e=>setWordCount(Number(e.target.value))} className="input">
                  {[400,600,800,1000,1200].map(n=><option key={n} value={n}>{n} words</option>)}
                </select>
              </div>
              <div>
                <label className="label">Tone</label>
                <select value={tone} onChange={e=>setTone(e.target.value)} className="input">
                  {['objective, journalistic','analytical','engaging, conversational','breaking news','opinion'].map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Seed Keywords</label>
              <div className="flex gap-2 mb-2">
                <input value={kwInput} onChange={e=>setKwInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addKw()}}}
                  className="input flex-1" placeholder="Add keyword + Enter"/>
                <button onClick={addKw} className="btn-secondary btn-sm">+</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map(kw=>(
                  <span key={kw} className="flex items-center gap-1 px-2 py-0.5 bg-ink-100 rounded-full text-xs text-ink-700">
                    {kw}<button onClick={()=>setKeywords(k=>k.filter(x=>x!==kw))} className="text-ink-400 hover:text-accent">×</button>
                  </span>
                ))}
              </div>
            </div>

            <button onClick={generate} disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading
                ? <span className="flex items-center gap-2"><span className="animate-spin">⟳</span>Generating in {selectedLang?.native}…</span>
                : `✦ Generate Article ${language !== 'en' ? `in ${selectedLang?.native}` : ''}`
              }
            </button>
          </div>

          {result && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-ink-900">Generated Article</h3>
                  {result.language_name && (
                    <span className="text-xs text-accent">{result.language_name as string}</span>
                  )}
                </div>
                <button onClick={useGenerated} className="btn-primary btn-sm">Save as Draft →</button>
              </div>
              <div>
                <p className="label">Headline</p>
                <p className="font-display font-bold text-ink-950 text-lg leading-snug">{result.title as string}</p>
              </div>
              <div>
                <p className="label">Excerpt</p>
                <p className="text-sm text-ink-600 leading-relaxed">{result.excerpt as string}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-2 rounded-lg p-3">
                  <p className="text-xs text-ink-400 mb-1">SEO Title</p>
                  <p className="text-xs text-ink-700">{result.seo_title as string}</p>
                </div>
                <div className="bg-surface-2 rounded-lg p-3">
                  <p className="text-xs text-ink-400 mb-1">Focus Keyword</p>
                  <p className="text-xs font-mono text-ink-700">{result.focus_keyword as string}</p>
                </div>
              </div>
              <div>
                <p className="label">Keywords</p>
                <div className="flex flex-wrap gap-1">
                  {(result.keywords as string[]||[]).map(kw=><span key={kw} className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full text-xs">{kw}</span>)}
                </div>
              </div>
              <div className="bg-surface-2 rounded-lg p-3 max-h-48 overflow-y-auto">
                <p className="text-xs text-ink-400 mb-1">Preview</p>
                <div className="text-xs text-ink-700 leading-relaxed" dangerouslySetInnerHTML={{__html:(result.content as string||'').slice(0,800)+'…'}}/>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HEADLINES */}
      {tab==='headlines' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-ink-900">Headline Generator</h3>
            <p className="text-sm text-ink-500">Generate 8 Google Discover-optimized headlines for any topic.</p>
            <div>
              <label className="label">News Topic or Story</label>
              <textarea value={hlTopic} onChange={e=>setHlTopic(e.target.value)} rows={3} className="input resize-none" placeholder="e.g. 'India's GDP growth Q3 2025 beats expectations'"/>
            </div>
            <button onClick={generateHeadlines} disabled={loading} className="btn-primary w-full justify-center">
              {loading?'Generating Headlines…':'Generate 8 Headlines'}
            </button>
          </div>
          {headlines.length>0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-ink-900 mb-4">Headline Variations</h3>
              <div className="space-y-2">
                {headlines.map((h,i)=>(
                  <div key={i} className="flex items-center gap-3 p-3 bg-surface-2 rounded-lg border border-ink-100 hover:border-accent transition-colors">
                    <span className="w-6 h-6 bg-accent/10 text-accent rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i+1}</span>
                    <span className="text-sm text-ink-800 flex-1">{h}</span>
                    <button onClick={()=>{setTitle(h);setTab('generate');toast.success('Headline copied to generator')}} className="btn-sm btn-secondary shrink-0">Use</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TRENDING */}
      {tab==='trending' && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-4 flex-wrap">
              <h3 className="font-semibold text-ink-900">Trending Topic Detector</h3>
              <select value={region} onChange={e=>setRegion(e.target.value)} className="input w-40">
                {['India','US','UAE','Global','UK','Singapore'].map(r=><option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={fetchTrending} disabled={loading} className="btn-primary">
                {loading?'Detecting…':'Detect Trends'}
              </button>
            </div>
          </div>
          {trending.length>0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {trending.map((t,i)=>(
                <div key={i} className="card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="badge bg-accent/10 text-accent">{t.category}</span>
                    <span className="text-xl font-display font-bold text-ink-200">#{i+1}</span>
                  </div>
                  <h4 className="font-display font-semibold text-ink-900 text-sm leading-snug mb-2">{t.title}</h4>
                  <p className="text-xs text-ink-500 leading-relaxed mb-3">{t.summary}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {t.keywords.slice(0,3).map(kw=><span key={kw} className="px-1.5 py-0.5 bg-ink-50 text-ink-500 rounded text-xs">{kw}</span>)}
                  </div>
                  <button onClick={()=>{setTitle(t.title);setKeywords(t.keywords||[]);setTab('generate');toast.success('Trend loaded!')}} className="btn-secondary btn-sm w-full justify-center">
                    Write Article →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
