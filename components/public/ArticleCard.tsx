import { formatDate } from '@/lib/utils'
import type { Article } from '@/types'
interface Props { article: Article; variant?: 'grid'|'list'|'compact' }
export function ArticleCard({ article, variant='grid' }: Props) {
  const cat = article.categories as unknown as {name:string;slug:string;color:string}|undefined
  const href = `/article/${article.slug}`
  const img = article.cover_image_url
  const date = formatDate(article.published_at||article.created_at)

  if (variant==='list') return (
    <a href={href} className="flex gap-4 py-4 border-b border-ink-100 hover:bg-surface-2 -mx-3 px-3 rounded-lg transition-colors group">
      {img && <div className="w-24 h-16 shrink-0 rounded-lg overflow-hidden bg-ink-100"><img src={img} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /></div>}
      <div className="flex-1 min-w-0">
        {cat && <span className="text-xs font-bold block mb-0.5" style={{color:cat.color}}>{cat.name}</span>}
        <h3 className="font-semibold text-ink-950 group-hover:text-accent transition-colors text-sm leading-snug line-clamp-2">{article.title}</h3>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-ink-400"><span>{article.reading_time_min} min</span><span>·</span><span>{date}</span></div>
      </div>
    </a>
  )

  if (variant==='compact') return (
    <a href={href} className="flex gap-3 group">
      {img && <div className="w-20 h-14 shrink-0 rounded-lg overflow-hidden bg-ink-100"><img src={img} alt={article.title} className="w-full h-full object-cover" /></div>}
      <div className="flex-1 min-w-0">
        {cat && <span className="text-xs font-bold block mb-0.5" style={{color:cat.color}}>{cat.name}</span>}
        <h3 className="font-semibold text-xs text-ink-900 group-hover:text-accent transition-colors leading-snug line-clamp-3">{article.title}</h3>
      </div>
    </a>
  )

  return (
    <a href={href} className="group block">
      <div className="aspect-video bg-ink-100 rounded-xl overflow-hidden mb-3">
        {img ? <img src={img} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">📰</div>}
      </div>
      {cat && <span className="text-xs font-bold" style={{color:cat.color}}>{cat.name}</span>}
      <h3 className="font-bold text-ink-950 group-hover:text-accent transition-colors text-base leading-snug mt-1 line-clamp-2">{article.title}</h3>
      {article.excerpt && <p className="text-sm text-ink-500 mt-1.5 line-clamp-2 leading-relaxed">{article.excerpt}</p>}
      <div className="flex items-center gap-2 mt-2 text-xs text-ink-400"><span>{article.author_name}</span><span>·</span><span>{article.reading_time_min} min</span><span>·</span><span>{date}</span></div>
    </a>
  )
}
