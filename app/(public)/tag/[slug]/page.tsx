export const runtime = 'edge'
import { createAdminClient } from '@/lib/supabase/admin'
import { ArticleCard } from '@/components/public/ArticleCard'
import { AdSlot } from '@/components/public/AdSlot'
import { notFound } from 'next/navigation'
import type { Article } from '@/types'
import type { Metadata } from 'next'

export const revalidate = 120

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createAdminClient()
  const { data } = await supabase.from('tags').select('name').eq('slug', slug).single()
  if (!data) return { title: 'Not Found' }
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendingverse.online'
  return {
    title: `${data.name} — TrendingVerse`,
    description: `All articles tagged with ${data.name} on TrendingVerse.`,
    alternates: { canonical: `${base}/tag/${slug}` },
    openGraph: {
      title: `${data.name} | TrendingVerse`,
      url: `${base}/tag/${slug}`,
      siteName: 'TrendingVerse',
      type: 'website',
    },
    twitter: { card: 'summary', title: `${data.name} | TrendingVerse` },
  }
}

export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { page = '1' } = await searchParams
  const supabase = createAdminClient()
  const limit = 12
  const offset = (parseInt(page) - 1) * limit

  const { data: tag } = await supabase.from('tags').select('id,name').eq('slug', slug).single()
  if (!tag) notFound()

  // Get article IDs for this tag
  const { data: tagLinks } = await supabase
    .from('article_tags')
    .select('article_id')
    .eq('tag_id', tag.id)

  const articleIds = (tagLinks || []).map((t: { article_id: string }) => t.article_id)
  if (!articleIds.length) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h1 className="text-3xl font-bold text-ink-950 mb-3">#{tag.name}</h1>
        <p className="text-ink-400">No articles with this tag yet.</p>
      </div>
    )
  }

  const { data: arts, count: total } = await supabase
    .from('articles')
    .select('*, categories(name,slug,color)', { count: 'exact' })
    .eq('status', 'published')
    .in('id', articleIds)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const totalPages = Math.ceil((total || 0) / limit)
  const currentPage = parseInt(page)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <AdSlot position="header" className="mb-8 py-3 bg-surface-2 rounded-xl" />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink-950 mb-1">#{tag.name}</h1>
        <p className="text-xs text-ink-400">{total} articles</p>
      </div>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="grid sm:grid-cols-2 gap-5">
            {((arts as Article[]) || []).map((a) => (
              <ArticleCard key={a.id} article={a} variant="grid" />
            ))}
          </div>
          {!arts?.length && (
            <p className="text-center text-ink-300 py-16">No articles found.</p>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <a
                  key={p}
                  href={`/tag/${slug}?page=${p}`}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                    p === currentPage
                      ? 'bg-accent text-white'
                      : 'bg-ink-50 text-ink-600 hover:bg-ink-100'
                  }`}
                >
                  {p}
                </a>
              ))}
            </div>
          )}
        </div>
        <aside>
          <AdSlot position="sidebar" className="sticky top-4" />
        </aside>
      </div>
    </div>
  )
}
