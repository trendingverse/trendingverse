import Link from 'next/link'
import { formatDate } from '@/lib/utils'
interface A { id:string; title:string; status:string; view_count:number; created_at:string; category_name?:string; seo_score:number }
export function RecentArticles({ articles }: { articles: A[] }) {
  const sc = (s:string) => ({published:'badge-published',draft:'badge-draft',scheduled:'badge-scheduled',archived:'badge-archived'}[s]||'badge-draft')
  const seoC = (n:number) => n>=70?'text-emerald-600':n>=40?'text-amber-600':'text-red-500'
  return (
    <div className="card">
      <div className="p-5 border-b border-ink-100 flex items-center justify-between">
        <h3 className="font-semibold text-sm text-ink-700">Recent Articles</h3>
        <Link href="/admin/articles" className="text-xs text-accent hover:underline">View all →</Link>
      </div>
      <div className="divide-y divide-ink-50">
        {articles.map(a => (
          <div key={a.id} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-2 transition-colors group">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-900 truncate">{a.title}</p>
              <p className="text-xs text-ink-400 mt-0.5">{a.category_name||'Uncategorized'} · {formatDate(a.created_at)}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`badge ${sc(a.status)}`}>{a.status}</span>
              <span className="text-xs text-ink-400">{a.view_count.toLocaleString()} views</span>
              <span className={`text-xs font-semibold ${seoC(a.seo_score)}`}>SEO {a.seo_score}</span>
              <Link href={`/admin/articles/${a.id}/edit`} className="text-xs text-accent hover:underline opacity-0 group-hover:opacity-100">Edit</Link>
            </div>
          </div>
        ))}
        {articles.length===0 && <p className="p-5 text-sm text-ink-300 text-center">No articles yet. <Link href="/admin/articles/new" className="text-accent hover:underline">Create one →</Link></p>}
      </div>
    </div>
  )
}
