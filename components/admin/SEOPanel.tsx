'use client'
import { useState } from 'react'
import Link from 'next/link'
import { computeSeoScore } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Article { id:string; title:string; slug:string; seo_score:number; seo_title?:string; meta_description?:string; focus_keyword?:string; keywords?:string[]; cover_image_url?:string; word_count:number; status:string }

export function SEOPanel({ articles: initial }: { articles: Article[] }) {
  const [articles, setArticles] = useState(initial)
  const [selected, setSelected] = useState<Article|null>(null)
  const [enhancing, setEnhancing] = useState(false)
  const [filter, setFilter] = useState<'all'|'poor'|'ok'|'good'>('all')

  const filtered = articles.filter(a => {
    if (filter==='poor') return a.seo_score < 40
    if (filter==='ok') return a.seo_score >= 40 && a.seo_score < 70
    if (filter==='good') return a.seo_score >= 70
    return true
  })

  async function enhanceSeo(article: Article) {
    setEnhancing(true)
    try {
      const artRes = await fetch(`/api/articles/${article.id}`)
      const artData = await artRes.json()
      const res = await fetch('/api/ai/seo', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ title: artData.title, content: artData.content||'', focus_keyword: artData.focus_keyword }) })
      const seo = await res.json()
      if (!res.ok) throw new Error(seo.error)
      const patch = { seo_title: seo.seo_title, meta_description: seo.meta_description, focus_keyword: seo.focus_keyword, keywords: seo.keywords }
      const { score } = computeSeoScore({ ...article, ...patch, content: artData.content })
      const updateRes = await fetch(`/api/articles/${article.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...patch, seo_score: score }) })
      if (updateRes.ok) {
        setArticles(a=>a.map(x=>x.id===article.id?{...x,...patch,seo_score:score}:x))
        setSelected(s=>s?{...s,...patch,seo_score:score}:s)
        toast.success('SEO enhanced!')
      }
    } catch(e) { toast.error((e as Error).message) }
    setEnhancing(false)
  }

  const scoreBar = (n: number) => ({
    color: n>=70?'bg-emerald-500':n>=40?'bg-amber-400':'bg-red-400',
    text: n>=70?'text-emerald-600':n>=40?'text-amber-600':'text-red-500',
    label: n>=70?'Good':n>=40?'Needs Work':'Poor',
  })

  const poor = articles.filter(a=>a.seo_score<40).length
  const ok = articles.filter(a=>a.seo_score>=40&&a.seo_score<70).length
  const good = articles.filter(a=>a.seo_score>=70).length

  return (
    <div className="space-y-5">
      {/* Overview stats */}
      <div className="grid grid-cols-3 gap-4">
        {[{label:'Poor (<40)',val:poor,color:'text-red-500',filter:'poor'},{label:'Needs Work',val:ok,color:'text-amber-500',filter:'ok'},{label:'Good (70+)',val:good,color:'text-emerald-600',filter:'good'}].map(s=>(
          <button key={s.label} onClick={()=>setFilter(f=>f===s.filter?'all':s.filter as typeof filter)}
            className={`card p-4 text-left transition-all hover:shadow-md ${filter===s.filter?'ring-2 ring-accent':''}`}>
            <p className="text-xs text-ink-400">{s.label}</p>
            <p className={`text-3xl font-display font-bold ${s.color}`}>{s.val}</p>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Article list */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide">{filtered.length} Articles</p>
            <button onClick={()=>setFilter('all')} className={`text-xs text-ink-400 hover:text-accent ${filter==='all'?'hidden':''}`}>Show all</button>
          </div>
          <div className="divide-y divide-ink-50 max-h-[600px] overflow-y-auto">
            {filtered.map(a=>{
              const s=scoreBar(a.seo_score)
              return (
                <button key={a.id} onClick={()=>setSelected(a)}
                  className={`w-full text-left px-4 py-3 hover:bg-surface-2 transition-colors ${selected?.id===a.id?'bg-accent/5':''}`}>
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <p className="text-sm font-medium text-ink-800 line-clamp-1">{a.title}</p>
                    <span className={`text-xs font-bold shrink-0 ${s.text}`}>{a.seo_score}</span>
                  </div>
                  <div className="h-1 bg-ink-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${s.color}`} style={{width:`${a.seo_score}%`}}/>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-ink-400">
                    <span className={`badge ${a.status==='published'?'badge-published':'badge-draft'}`}>{a.status}</span>
                    <span>{a.word_count} words</span>
                    {a.focus_keyword && <span className="font-mono">{a.focus_keyword}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Article SEO detail */}
        {selected ? (
          <div className="card p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-ink-950 leading-snug">{selected.title}</h3>
                <p className="text-xs text-ink-400 font-mono mt-0.5">/article/{selected.slug}</p>
              </div>
              <div className={`text-3xl font-display font-bold ${scoreBar(selected.seo_score).text}`}>
                {selected.seo_score}
              </div>
            </div>
            <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${scoreBar(selected.seo_score).color}`} style={{width:`${selected.seo_score}%`}}/>
            </div>

            {/* Issues */}
            <div className="space-y-2">
              {computeSeoScore(selected).suggestions.map((s,i)=>(
                <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${
                  s.type==='error'?'bg-red-50 text-red-700':s.type==='warning'?'bg-amber-50 text-amber-700':s.type==='success'?'bg-emerald-50 text-emerald-700':'bg-blue-50 text-blue-700'}`}>
                  <span className="shrink-0">{s.type==='error'?'✗':s.type==='warning'?'⚠':s.type==='success'?'✓':'ℹ'}</span>
                  <span>{s.message}</span>
                </div>
              ))}
            </div>

            {/* Current meta */}
            <div className="space-y-2">
              {[
                { label:'SEO Title', val: selected.seo_title },
                { label:'Meta Description', val: selected.meta_description },
                { label:'Focus Keyword', val: selected.focus_keyword },
              ].map(f=>(
                <div key={f.label} className="bg-surface-2 rounded-lg p-3">
                  <p className="text-xs text-ink-400 mb-1">{f.label}</p>
                  <p className="text-xs text-ink-700">{f.val||<span className="text-red-400 italic">Not set</span>}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={()=>enhanceSeo(selected)} disabled={enhancing} className="btn-primary flex-1 justify-center">
                {enhancing?'Enhancing…':'✦ AI Enhance SEO'}
              </button>
              <Link href={`/admin/articles/${selected.id}/edit`} className="btn-secondary flex-1 text-center flex items-center justify-center">
                Edit Article
              </Link>
            </div>
          </div>
        ) : (
          <div className="card flex items-center justify-center text-ink-300 text-sm" style={{minHeight:300}}>
            Select an article to view SEO details
          </div>
        )}
      </div>
    </div>
  )
}
