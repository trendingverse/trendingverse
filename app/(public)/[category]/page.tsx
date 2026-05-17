// Prevent /admin from being caught by category route
const { category: slug } = await params
if (['admin','login','api','search','article'].includes(slug)) notFound()
import { createClient } from '@/lib/supabase/server'
import { ArticleCard } from '@/components/public/ArticleCard'
import { AdSlot } from '@/components/public/AdSlot'
import { notFound } from 'next/navigation'
import type { Article } from '@/types'
import type { Metadata } from 'next'

export const revalidate = 120
interface Props { params: Promise<{ category: string }>; searchParams: Promise<{ page?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('categories').select('name,meta_title,meta_desc').eq('slug', slug).single()
  if (!data) return { title: 'Not Found' }
  return { title: data.meta_title || data.name, description: data.meta_desc || undefined }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { category: slug } = await params
  const { page = '1' } = await searchParams
  const supabase = await createClient()
  const limit = 12; const offset = (parseInt(page) - 1) * limit

  const { data: cat } = await supabase.from('categories').select('*').eq('slug', slug).single()
  if (!cat) notFound()

  const { data: arts, count: total } = await supabase.from('articles')
    .select('*, categories(name,slug,color)', { count: 'exact' })
    .eq('status', 'published').eq('category_id', cat.id)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const totalPages = Math.ceil((total || 0) / limit)
  const currentPage = parseInt(page)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <AdSlot position="header" className="mb-8 py-3 bg-surface-2 rounded-xl" />
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-8 rounded-full" style={{ background: cat.color }} />
          <h1 className="font-display text-3xl font-bold text-ink-950">{cat.name}</h1>
        </div>
        {cat.description && <p className="text-ink-500 ml-6">{cat.description}</p>}
        <p className="text-xs text-ink-400 ml-6 mt-1">{total} articles</p>
      </div>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="grid sm:grid-cols-2 gap-5">
            {(arts as Article[] || []).map(a => <ArticleCard key={a.id} article={a} variant="grid" />)}
          </div>
          {arts?.length === 0 && <p className="text-center text-ink-300 py-16">No articles in this category yet.</p>}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <a key={p} href={`/${slug}?page=${p}`}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${p === currentPage ? 'bg-accent text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'}`}>
                  {p}
                </a>
              ))}
            </div>
          )}
        </div>
        <aside><AdSlot position="sidebar" className="sticky top-4" /></aside>
      </div>
    </div>
  )
}
