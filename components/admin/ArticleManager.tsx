'use client'
import { useState } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Article {
  id: string; title: string; slug: string; status: string
  is_featured: boolean; is_sponsored: boolean; category_name?: string
  author_name: string; view_count: number; seo_score: number
  word_count: number; published_at?: string; created_at: string
}
interface Category { id: string; name: string; slug: string }

export function ArticleManager({ articles: init, categories }: { articles: Article[]; categories: Category[] }) {
  const [articles, setArticles] = useState(init)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatus] = useState('all')
  const [catFilter, setCat] = useState('all')
  const [deleting, setDeleting] = useState<string | null>(null)

  const filtered = articles.filter(a => {
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (catFilter !== 'all' && a.category_name !== catFilter) return false
    return true
  })

  async function deleteArticle(id: string) {
    if (!confirm('Permanently delete this article? This cannot be undone.')) return
    setDeleting(id)
    const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' })
    if (res.ok) { setArticles(p => p.filter(a => a.id !== id)); toast.success('Article deleted') }
    else toast.error('Delete failed')
    setDeleting(null)
  }

  async function toggleStatus(id: string, current: string) {
    const next = current === 'published' ? 'draft' : 'published'
    const body: Record<string, string> = { status: next }
    if (next === 'published') body.published_at = new Date().toISOString()
    const res = await fetch(`/api/articles/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { setArticles(p => p.map(a => a.id === id ? { ...a, status: next } : a)); toast.success(`Set to ${next}`) }
    else toast.error('Update failed')
  }

  const sBadge = (s: string) => ({ published: 'badge-published', draft: 'badge-draft', scheduled: 'badge-scheduled', archived: 'badge-archived' }[s] ?? 'badge-draft')
  const seoCol = (n: number) => n >= 70 ? 'text-emerald-600' : n >= 40 ? 'text-amber-500' : 'text-red-500'

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="flex gap-2 flex-wrap">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search articles…" className="input w-52" />
          <select value={statusFilter} onChange={e => setStatus(e.target.value)} className="input w-36">
            <option value="all">All Status</option>
            {['draft','published','scheduled','archived'].map(s => <option key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</option>)}
          </select>
          <select value={catFilter} onChange={e => setCat(e.target.value)} className="input w-40">
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <Link href="/admin/articles/new" className="btn-primary shrink-0">+ New Article</Link>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 border-b border-ink-100">
              <tr>
                {['Title','Status','Category','SEO','Views','Date',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {filtered.map(a => (
                <tr key={a.id} className="group hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-medium text-ink-900 truncate">{a.title}</p>
                    <p className="text-xs text-ink-400 font-mono truncate mt-0.5">/article/{a.slug}</p>
                    <div className="flex gap-1 mt-1">
                      {a.is_featured && <span className="badge badge-featured">Featured</span>}
                      {a.is_sponsored && <span className="badge badge-sponsored">Sponsored</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap"><span className={`badge ${sBadge(a.status)}`}>{a.status}</span></td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-600 text-xs">{a.category_name || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><span className={`font-bold text-sm ${seoCol(a.seo_score)}`}>{a.seo_score}</span></td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-600">{a.view_count.toLocaleString()}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-400 text-xs">{formatDate(a.published_at || a.created_at)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/admin/articles/${a.id}/edit`} className="btn-secondary btn-sm">Edit</Link>
                      <button onClick={() => toggleStatus(a.id, a.status)} className="btn-ghost btn-sm">{a.status==='published'?'Unpublish':'Publish'}</button>
                      <a href={`/article/${a.slug}`} target="_blank" className="btn-ghost btn-sm">↗</a>
                      <button onClick={() => deleteArticle(a.id)} disabled={deleting===a.id} className="btn-danger btn-sm">{deleting===a.id?'…':'✕'}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="py-16 text-center text-ink-300">No articles found.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-ink-50 text-xs text-ink-400">{filtered.length} of {articles.length} articles</div>
      </div>
    </div>
  )
}
