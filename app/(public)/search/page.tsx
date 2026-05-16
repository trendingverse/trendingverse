import { createClient } from '@/lib/supabase/server'
import { ArticleCard } from '@/components/public/ArticleCard'
import type { Article } from '@/types'

interface Props { searchParams: Promise<{ q?: string }> }
export default async function SearchPage({ searchParams }: Props) {
  const { q = '' } = await searchParams
  const supabase = await createClient()
  let articles: Article[] = []
  if (q.trim()) {
    const { data } = await supabase.from('articles')
      .select('*, categories(name,slug,color)')
      .eq('status','published')
      .ilike('title', `%${q}%`)
      .order('published_at', { ascending: false })
      .limit(24)
    articles = (data as Article[]) || []
  }
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl font-bold text-ink-950 mb-2">{q ? `Results for "${q}"` : 'Search'}</h1>
      <p className="text-sm text-ink-400 mb-8">{articles.length} articles found</p>
      <form className="flex gap-3 mb-8">
        <input name="q" defaultValue={q} className="input flex-1 text-base" placeholder="Search articles…" autoFocus />
        <button type="submit" className="btn-primary px-6">Search</button>
      </form>
      {articles.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {articles.map(a => <ArticleCard key={a.id} article={a} variant="grid" />)}
        </div>
      ) : q ? (
        <p className="text-ink-400 text-center py-16">No articles found for "{q}". Try different keywords.</p>
      ) : null}
    </div>
  )
}
