import { createClient } from '@/lib/supabase/server'
import { ArticleCard } from '@/components/public/ArticleCard'
import { AdSlot } from '@/components/public/AdSlot'
import type { Article } from '@/types'
export const revalidate = 60

export default async function HomePage() {
  const supabase = await createClient()
  const [{ data: articles }, { data: featured }] = await Promise.all([
    supabase.from('articles').select('*, categories(name,slug,color)').eq('status','published').order('published_at',{ascending:false}).limit(20),
    supabase.from('articles').select('*, categories(name,slug,color)').eq('status','published').eq('is_featured',true).order('published_at',{ascending:false}).limit(4),
  ])
  const hero = (featured as Article[]||[])[0]
  const featuredRest = (featured as Article[]||[]).slice(1,4)
  const main = (articles as Article[]||[]).filter(a => a.id !== hero?.id)
  return (
    <div>
      <AdSlot position="header" className="py-3 bg-surface-2 border-b border-ink-100" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {hero && (
          <div className="grid lg:grid-cols-3 gap-6 mb-10">
            <div className="lg:col-span-2"><HeroCard article={hero} /></div>
            <div className="flex flex-col gap-4">{featuredRest.map(a => <ArticleCard key={a.id} article={a} variant="compact" />)}</div>
          </div>
        )}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-ink-950">Latest Stories</h2>
              <span className="text-xs text-ink-400 uppercase tracking-widest">Live</span>
            </div>
            <div className="space-y-1">{main.slice(0,5).map(a => <ArticleCard key={a.id} article={a} variant="list" />)}</div>
            <div className="my-6"><AdSlot position="inline" /></div>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">{main.slice(5,13).map(a => <ArticleCard key={a.id} article={a} variant="grid" />)}</div>
          </div>
          <aside className="space-y-6">
            <TrendingSidebar articles={main.slice(0,8)} />
            <AdSlot position="sidebar" className="sticky top-20" />
          </aside>
        </div>
      </div>
      <AdSlot position="footer" className="border-t border-ink-100 bg-surface-2 py-3" />
    </div>
  )
}

function HeroCard({ article }: { article: Article }) {
  const cat = article.categories as unknown as {name:string;slug:string;color:string}|undefined
  return (
    <a href={`/article/${article.slug}`} className="group block">
      <div className="relative aspect-[16/9] bg-ink-100 rounded-xl overflow-hidden mb-4">
        {article.cover_image_url ? <img src={article.cover_image_url} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full bg-gradient-to-br from-red-50 to-ink-200 flex items-center justify-center text-6xl opacity-20">📰</div>}
        {cat && <span className="absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{background:cat.color}}>{cat.name}</span>}
        {article.is_sponsored && <span className="absolute top-3 right-3 badge badge-sponsored">Sponsored</span>}
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-ink-950 group-hover:text-accent transition-colors mb-2">{article.title}</h1>
      {article.excerpt && <p className="text-ink-600 text-sm leading-relaxed line-clamp-2">{article.excerpt}</p>}
      <div className="flex items-center gap-3 mt-3 text-xs text-ink-400">
        <span>{article.author_name}</span><span>·</span><span>{article.reading_time_min} min read</span><span>·</span>
        <span>{new Date(article.published_at||'').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
      </div>
    </a>
  )
}

function TrendingSidebar({ articles }: { articles: Article[] }) {
  return (
    <div className="card p-5">
      <h3 className="font-bold text-base mb-4 text-ink-950 flex items-center gap-2"><span className="w-1.5 h-4 bg-accent rounded-full" />Trending Now</h3>
      <ol className="space-y-3">{articles.slice(0,6).map((a,i) => (
        <li key={a.id}><a href={`/article/${a.slug}`} className="flex gap-3 group">
          <span className="text-2xl font-bold text-ink-200 group-hover:text-accent/30 transition-colors leading-none mt-0.5 w-7 shrink-0">{i+1}</span>
          <span className="text-sm font-medium text-ink-700 group-hover:text-accent transition-colors leading-snug line-clamp-2">{a.title}</span>
        </a></li>
      ))}</ol>
    </div>
  )
}
