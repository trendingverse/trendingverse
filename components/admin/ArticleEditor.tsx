'use client'
import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TipImage from '@tiptap/extension-image'
import TipLink from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import toast from 'react-hot-toast'
import { slugify, computeSeoScore, readingTime, wordCount } from '@/lib/utils'
import type { Category, Tag } from '@/types'

interface Props { article?: Record<string,unknown>; categories: Category[]; tags: Tag[] }

export function ArticleEditor({ article, categories, tags }: Props) {
  const router = useRouter()
  const isEdit = !!article
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState<string|null>(null)

  const [title, setTitle] = useState((article?.title as string)||'')
  const [slug, setSlug] = useState((article?.slug as string)||'')
  const [excerpt, setExcerpt] = useState((article?.excerpt as string)||'')
  const [coverUrl, setCoverUrl] = useState((article?.cover_image_url as string)||'')
  const [coverAlt, setCoverAlt] = useState((article?.cover_image_alt as string)||'')
  const [categoryId, setCategoryId] = useState((article?.category_id as string)||'')
  const [selectedTags, setSelectedTags] = useState<string[]>(
    (article?.article_tags as {tag_id:string}[]||[]).map(t=>t.tag_id)
  )
  const [status, setStatus] = useState((article?.status as string)||'draft')
  const [isFeatured, setIsFeatured] = useState((article?.is_featured as boolean)||false)
  const [isSponsored, setIsSponsored] = useState((article?.is_sponsored as boolean)||false)
  const [sponsorName, setSponsorName] = useState((article?.sponsor_name as string)||'')
  const [scheduledAt, setScheduledAt] = useState((article?.scheduled_at as string)||'')
  const [seoTitle, setSeoTitle] = useState((article?.seo_title as string)||'')
  const [metaDesc, setMetaDesc] = useState((article?.meta_description as string)||'')
  const [focusKw, setFocusKw] = useState((article?.focus_keyword as string)||'')
  const [keywords, setKeywords] = useState<string[]>((article?.keywords as string[])||[])
  const [kwInput, setKwInput] = useState('')
  const [seoScore, setSeoScore] = useState(article?.seo_score as number||0)
  const [seoSugs, setSeoSugs] = useState<{type:string;message:string}[]>([])
  const [headlines, setHeadlines] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'content'|'seo'|'meta'|'schedule'>('content')

  const editor = useEditor({
    extensions: [
      StarterKit, Underline, TipImage, TipLink.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Start writing your article…' }),
    ],
    content: (article?.content as string)||'',
    editorProps: { attributes: { class: 'prose max-w-none p-4 min-h-96 focus:outline-none text-ink-900 text-sm leading-relaxed' } },
  })

  // Auto-slug from title
  useEffect(() => { if (!isEdit && title) setSlug(slugify(title)) }, [title, isEdit])

  // Live SEO score
  useEffect(() => {
    const content = editor?.getHTML() || ''
    const { score, suggestions } = computeSeoScore({ title, seo_title: seoTitle, meta_description: metaDesc, focus_keyword: focusKw, keywords, cover_image_url: coverUrl, content })
    setSeoScore(score)
    setSeoSugs(suggestions)
  }, [title, seoTitle, metaDesc, focusKw, keywords, coverUrl, editor])

  const addKeyword = () => {
    const kw = kwInput.trim()
    if (kw && !keywords.includes(kw)) { setKeywords(k=>[...k,kw]); setKwInput('') }
  }
  const removeKeyword = (kw: string) => setKeywords(k=>k.filter(x=>x!==kw))
  const toggleTag = (id: string) => setSelectedTags(t=>t.includes(id)?t.filter(x=>x!==id):[...t,id])

  async function aiGenerate() {
    if (!title) { toast.error('Enter a title first'); return }
    setAiLoading('generate')
    try {
      const res = await fetch('/api/ai/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title, keywords, category: categories.find(c=>c.id===categoryId)?.name }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      editor?.commands.setContent(data.content)
      if (data.excerpt) setExcerpt(data.excerpt)
      if (data.seo_title) setSeoTitle(data.seo_title)
      if (data.meta_description) setMetaDesc(data.meta_description)
      if (data.focus_keyword) setFocusKw(data.focus_keyword)
      if (data.keywords?.length) setKeywords(data.keywords)
      toast.success('Article generated!')
    } catch(e) { toast.error((e as Error).message) }
    setAiLoading(null)
  }

  async function aiSeo() {
    const content = editor?.getHTML()||''
    if (!title||!content) { toast.error('Title and content required'); return }
    setAiLoading('seo')
    try {
      const res = await fetch('/api/ai/seo', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title, content, focus_keyword: focusKw }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.seo_title) setSeoTitle(data.seo_title)
      if (data.meta_description) setMetaDesc(data.meta_description)
      if (data.focus_keyword) setFocusKw(data.focus_keyword)
      if (data.keywords?.length) setKeywords(data.keywords)
      toast.success('SEO enhanced!')
    } catch(e) { toast.error((e as Error).message) }
    setAiLoading(null)
  }

  async function aiHeadlines() {
    if (!title) { toast.error('Enter a title first'); return }
    setAiLoading('headlines')
    try {
      const res = await fetch('/api/ai/headlines', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ topic: title }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setHeadlines(data.headlines||[])
    } catch(e) { toast.error((e as Error).message) }
    setAiLoading(null)
  }

  async function aiRewrite() {
    const content = editor?.getHTML()||''
    if (!content) { toast.error('Write some content first'); return }
    setAiLoading('rewrite')
    try {
      const res = await fetch('/api/ai/rewrite', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content, instruction: 'Improve readability, engagement and journalistic quality' }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      editor?.commands.setContent(data.content)
      toast.success('Content rewritten!')
    } catch(e) { toast.error((e as Error).message) }
    setAiLoading(null)
  }

  async function save(saveStatus?: string) {
    if (!title) { toast.error('Title is required'); return }
    setSaving(true)
    const content = editor?.getHTML()||''
    const body = {
      title, slug, excerpt, content,
      cover_image_url: coverUrl, cover_image_alt: coverAlt,
      category_id: categoryId||null, tag_ids: selectedTags,
      status: saveStatus||status,
      is_featured: isFeatured, is_sponsored: isSponsored, sponsor_name: sponsorName,
      scheduled_at: scheduledAt||null,
      seo_title: seoTitle||title, meta_description: metaDesc,
      focus_keyword: focusKw, keywords,
      reading_time_min: readingTime(content), word_count: wordCount(content),
    }
    try {
      const url = isEdit ? `/api/articles/${article.id}` : '/api/articles'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(isEdit ? 'Article saved!' : 'Article created!')
      router.push('/admin/articles')
      router.refresh()
    } catch(e) { toast.error((e as Error).message) }
    setSaving(false)
  }

  const scoreColor = seoScore>=70?'text-emerald-600':seoScore>=40?'text-amber-500':'text-red-500'
  const scoreBarColor = seoScore>=70?'bg-emerald-500':seoScore>=40?'bg-amber-400':'bg-red-400'

  return (
    <div className="grid xl:grid-cols-3 gap-6">
      {/* Main editor column */}
      <div className="xl:col-span-2 space-y-4">
        {/* Title */}
        <div className="card p-5">
          <input value={title} onChange={e=>setTitle(e.target.value)}
            className="w-full text-2xl font-display font-bold bg-transparent outline-none text-ink-950 placeholder:text-ink-300 border-b border-ink-100 pb-3 mb-3"
            placeholder="Article Title…" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-400">Slug:</span>
            <input value={slug} onChange={e=>setSlug(e.target.value)}
              className="flex-1 text-xs font-mono text-ink-500 bg-surface-2 border border-ink-100 rounded px-2 py-1 outline-none focus:border-accent" />
          </div>
        </div>

        {/* AI Toolbar */}
        <div className="card p-3 flex flex-wrap gap-2">
          <span className="text-xs font-semibold text-ink-400 self-center mr-1">✦ AI:</span>
          {[
            { label:'Generate Article', key:'generate', fn:aiGenerate },
            { label:'Generate Headlines', key:'headlines', fn:aiHeadlines },
            { label:'Enhance SEO', key:'seo', fn:aiSeo },
            { label:'Rewrite & Improve', key:'rewrite', fn:aiRewrite },
          ].map(btn=>(
            <button key={btn.key} onClick={btn.fn} disabled={!!aiLoading}
              className="btn btn-sm bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100">
              {aiLoading===btn.key ? <span className="flex items-center gap-1"><span className="animate-spin">⟳</span>{btn.label}…</span> : btn.label}
            </button>
          ))}
        </div>

        {/* Headline suggestions */}
        {headlines.length>0 && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide">Headline Suggestions</p>
              <button onClick={()=>setHeadlines([])} className="text-xs text-ink-400 hover:text-accent">Clear</button>
            </div>
            <div className="space-y-2">
              {headlines.map((h,i)=>(
                <div key={i} className="flex items-center justify-between gap-3 p-2.5 bg-surface-2 rounded-lg border border-ink-100">
                  <span className="text-sm text-ink-800">{h}</span>
                  <button onClick={()=>{setTitle(h);setHeadlines([])}} className="btn-primary btn-sm shrink-0">Use</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="card overflow-hidden">
          <div className="flex border-b border-ink-100">
            {(['content','seo','meta','schedule'] as const).map(tab=>(
              <button key={tab} onClick={()=>setActiveTab(tab)}
                className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors ${activeTab===tab?'text-accent border-b-2 border-accent':'text-ink-400 hover:text-ink-700'}`}>
                {tab==='content'?'Content':tab==='seo'?'SEO':tab==='meta'?'Meta':' Schedule'}
              </button>
            ))}
          </div>

          {activeTab==='content' && (
            <div>
              <div className="border-b border-ink-100 px-3 py-2 flex flex-wrap gap-1">
                {[
                  { label:'B', cmd:()=>editor?.chain().focus().toggleBold().run(), active:editor?.isActive('bold') },
                  { label:'I', cmd:()=>editor?.chain().focus().toggleItalic().run(), active:editor?.isActive('italic') },
                  { label:'U', cmd:()=>editor?.chain().focus().toggleUnderline().run(), active:editor?.isActive('underline') },
                  { label:'H2', cmd:()=>editor?.chain().focus().toggleHeading({level:2}).run(), active:editor?.isActive('heading',{level:2}) },
                  { label:'H3', cmd:()=>editor?.chain().focus().toggleHeading({level:3}).run(), active:editor?.isActive('heading',{level:3}) },
                  { label:'• List', cmd:()=>editor?.chain().focus().toggleBulletList().run(), active:editor?.isActive('bulletList') },
                  { label:'Quote', cmd:()=>editor?.chain().focus().toggleBlockquote().run(), active:editor?.isActive('blockquote') },
                  { label:'––', cmd:()=>editor?.chain().focus().setHorizontalRule().run(), active:false },
                ].map(btn=>(
                  <button key={btn.label} onClick={btn.cmd}
                    className={`px-2.5 py-1 text-xs rounded font-mono font-semibold transition-colors ${btn.active?'bg-accent text-white':'bg-ink-50 text-ink-700 hover:bg-ink-100'}`}>
                    {btn.label}
                  </button>
                ))}
              </div>
              <EditorContent editor={editor} />
              <div className="px-4 py-2 border-t border-ink-100 flex items-center gap-4 text-xs text-ink-400">
                <span>{wordCount(editor?.getText()||'')} words</span>
                <span>{readingTime(editor?.getText()||'')} min read</span>
              </div>
            </div>
          )}

          {activeTab==='seo' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-ink-600">SEO Score</span>
                    <span className={`text-2xl font-display font-bold ${scoreColor}`}>{seoScore}/100</span>
                  </div>
                  <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${scoreBarColor}`} style={{width:`${seoScore}%`}}/>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {seoSugs.map((s,i)=>(
                  <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${
                    s.type==='error'?'bg-red-50 text-red-700':s.type==='warning'?'bg-amber-50 text-amber-700':s.type==='success'?'bg-emerald-50 text-emerald-700':'bg-blue-50 text-blue-700'
                  }`}>
                    <span>{s.type==='error'?'✗':s.type==='warning'?'⚠':s.type==='success'?'✓':'ℹ'}</span>
                    <span>{s.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab==='meta' && (
            <div className="p-5 space-y-4">
              <div>
                <label className="label">SEO Title ({seoTitle.length}/60)</label>
                <input value={seoTitle} onChange={e=>setSeoTitle(e.target.value)} className="input" placeholder="SEO optimized title…" maxLength={70}/>
              </div>
              <div>
                <label className="label">Meta Description ({metaDesc.length}/160)</label>
                <textarea value={metaDesc} onChange={e=>setMetaDesc(e.target.value)} rows={3} className="input resize-none" placeholder="Compelling meta description…" maxLength={170}/>
              </div>
              <div>
                <label className="label">Focus Keyword</label>
                <input value={focusKw} onChange={e=>setFocusKw(e.target.value)} className="input" placeholder="primary keyword"/>
              </div>
              <div>
                <label className="label">Keywords</label>
                <div className="flex gap-2 mb-2">
                  <input value={kwInput} onChange={e=>setKwInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addKeyword()}}} className="input flex-1" placeholder="Add keyword + Enter"/>
                  <button onClick={addKeyword} className="btn-secondary btn-sm">Add</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map(kw=>(
                    <span key={kw} className="flex items-center gap-1 px-2.5 py-1 bg-ink-100 rounded-full text-xs text-ink-700">
                      {kw}<button onClick={()=>removeKeyword(kw)} className="text-ink-400 hover:text-accent ml-0.5">×</button>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Excerpt</label>
                <textarea value={excerpt} onChange={e=>setExcerpt(e.target.value)} rows={3} className="input resize-none" placeholder="Short summary for article cards…"/>
              </div>
            </div>
          )}

          {activeTab==='schedule' && (
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Publish Status</label>
                <select value={status} onChange={e=>setStatus(e.target.value)} className="input">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              {status==='scheduled' && (
                <div>
                  <label className="label">Schedule Date & Time</label>
                  <input type="datetime-local" value={scheduledAt} onChange={e=>setScheduledAt(e.target.value)} className="input"/>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Publish actions */}
        <div className="card p-4 space-y-3">
          <div className="flex gap-2">
            <button onClick={()=>save('draft')} disabled={saving} className="btn-secondary flex-1 justify-center">Save Draft</button>
            <button onClick={()=>save('published')} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving?'Saving…':'Publish'}
            </button>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={isFeatured} onChange={e=>setIsFeatured(e.target.checked)} className="accent-accent"/>
              <span className="text-ink-700">Featured</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={isSponsored} onChange={e=>setIsSponsored(e.target.checked)} className="accent-accent"/>
              <span className="text-ink-700">Sponsored</span>
            </label>
          </div>
          {isSponsored && (
            <input value={sponsorName} onChange={e=>setSponsorName(e.target.value)} className="input" placeholder="Sponsor name"/>
          )}
        </div>

        {/* Cover image */}
        <div className="card p-4 space-y-3">
          <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide">Cover Image</p>
          {coverUrl && <img src={coverUrl} alt={coverAlt} className="w-full aspect-video object-cover rounded-lg"/>}
          <input value={coverUrl} onChange={e=>setCoverUrl(e.target.value)} className="input text-xs" placeholder="Image URL or upload below…"/>
          <input value={coverAlt} onChange={e=>setCoverAlt(e.target.value)} className="input text-xs" placeholder="Alt text"/>
          <MediaPicker onSelect={(url,alt)=>{setCoverUrl(url);setCoverAlt(alt)}}/>
        </div>

        {/* Category */}
        <div className="card p-4 space-y-3">
          <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide">Category</p>
          <select value={categoryId} onChange={e=>setCategoryId(e.target.value)} className="input">
            <option value="">Select category…</option>
            {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Tags */}
        <div className="card p-4 space-y-2">
          <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map(t=>(
              <button key={t.id} onClick={()=>toggleTag(t.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selectedTags.includes(t.id)?'bg-accent text-white border-accent':'bg-surface-2 text-ink-600 border-ink-200 hover:border-accent'}`}>
                {t.name}
              </button>
            ))}
          </div>
          <CreateTagInline onCreated={()=>{}} />
        </div>

        {/* SEO quick view */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide">SEO Score</p>
            <span className={`text-lg font-display font-bold ${scoreColor}`}>{seoScore}</span>
          </div>
          <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${scoreBarColor}`} style={{width:`${seoScore}%`}}/>
          </div>
          <p className="text-xs text-ink-400 mt-2">{seoSugs.filter(s=>s.type==='error').length} errors · {seoSugs.filter(s=>s.type==='warning').length} warnings</p>
        </div>
      </div>
    </div>
  )
}

function MediaPicker({ onSelect }: { onSelect: (url:string, alt:string) => void }) {
  const [open, setOpen] = useState(false)
  const [media, setMedia] = useState<{id:string;url:string;original_name:string}[]>([])
  const [uploading, setUploading] = useState(false)

  async function loadMedia() {
    const res = await fetch('/api/media')
    if (res.ok) { const d = await res.json(); setMedia(d) }
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData(); fd.append('file', file); fd.append('folder','articles')
    const res = await fetch('/api/media', { method:'POST', body: fd })
    if (res.ok) { await loadMedia(); toast.success('Uploaded!') }
    else toast.error('Upload failed')
    setUploading(false)
  }

  return (
    <>
      <button onClick={()=>{setOpen(true);loadMedia()}} className="btn-secondary btn-sm w-full justify-center">
        Browse Library
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-ink-100">
              <h3 className="font-semibold text-ink-900">Media Library</h3>
              <div className="flex items-center gap-2">
                <label className="btn-primary btn-sm cursor-pointer">
                  {uploading?'Uploading…':'Upload Image'}
                  <input type="file" accept="image/*" className="hidden" onChange={upload} disabled={uploading}/>
                </label>
                <button onClick={()=>setOpen(false)} className="text-ink-400 hover:text-accent text-xl leading-none">×</button>
              </div>
            </div>
            <div className="overflow-y-auto p-4 grid grid-cols-3 sm:grid-cols-4 gap-3">
              {media.map(m=>(
                <button key={m.id} onClick={()=>{onSelect(m.url, m.original_name);setOpen(false)}}
                  className="group relative aspect-square bg-ink-50 rounded-lg overflow-hidden border-2 border-transparent hover:border-accent transition-colors">
                  <img src={m.url} alt={m.original_name} className="w-full h-full object-cover"/>
                </button>
              ))}
              {media.length===0 && <p className="col-span-4 text-center text-ink-400 text-sm py-8">No images yet. Upload one!</p>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function CreateTagInline({ onCreated }: { onCreated: () => void }) {
  const [val, setVal] = useState('')
  const [loading, setLoading] = useState(false)
  async function create() {
    if (!val.trim()) return
    setLoading(true)
    const res = await fetch('/api/tags', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: val }) })
    if (res.ok) { setVal(''); onCreated(); toast.success('Tag created') }
    setLoading(false)
  }
  return (
    <div className="flex gap-1.5 mt-1">
      <input value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();create()}}}
        className="input text-xs flex-1" placeholder="+ New tag"/>
      <button onClick={create} disabled={loading} className="btn-secondary btn-sm">Add</button>
    </div>
  )
}
