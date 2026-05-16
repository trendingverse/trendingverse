import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdSlot } from '@/components/public/AdSlot'
import { ArticleCard } from '@/components/public/ArticleCard'
import { injectAffiliateLinks, formatDate } from '@/lib/utils'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { Article } from '@/types'
export const revalidate = 300

interface Props { params: Promise<{slug:string}> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('articles').select('title,meta_description,seo_title,og_image_url,cover_image_url,slug').eq('slug',slug).eq('status','published').single()
  if (!data) return { title: 'Not Found' }
  return { title: data.seo_title||data.title, description: data.meta_description, openGraph: { title: data.seo_title||data.title, images: data.og_image_url||data.cover_image_url ? [{url:data.og_image_url||data.cover_image_url}] : [] } }
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: article } = await supabase.from('articles').select('*, categories(name,slug,color), article_tags(tags(name,slug))').eq('slug',slug).eq('status','published').single()
  if (!article) notFound()
  admin.from('article_views').insert({ article_id: article.id }).then(() => {})
  const { data: affiliates } = await supabase.from('affiliate_links').select('url,trigger_keywords').eq('is_active',true)
  const content = affiliates?.length ? injectAffiliateLinks(article.content||'', affiliates) : article.content||''
  const { data: related } = await supabase.from('articles').select('id,title,slug,cover_image_url,excerpt,category_name,published_at,reading_time_min,author_name').eq('status','published').eq('category_id',article.category_id||'').neq('id',article.id).limit(3)
  const cat = article.categories as unknown as {name:string;slug:string;color:string}|null
  const tags = (article.article_tags as unknown as {tags:{name:string;slug:string}}[])||[]
  const schema = { '@context':'https://schema.org','@type':article.schema_type||'NewsArticle', headline:article.title, description:article.excerpt, image:article.cover_image_url, author:{name:article.author_name}, publisher:{name:'TrendingVerse',url:'https://trendingverse.online'}, datePublished:article.published_at, dateModified:article.updated_at }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}} />
      <AdSlot position="header" className="py-3 bg-surface-2 border-b border-ink-100" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-10">
          <article className="lg:col-span-2">
            <nav className="flex items-center gap-2 text-xs text-ink-400 mb-5">
              <a href="/" className="hover:text-accent">Home</a>
              {cat && <><span>/</span><a href={`/${cat.slug}`} className="hover:text-accent" style={{color:cat.color}}>{cat.name}</a></>}
              <span>/</span><span className="text-ink-600 line-clamp-1">{article.title}</span>
            </nav>
            {article.is_sponsored && <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700"><strong>Sponsored Content</strong>{article.sponsor_disclosure ? ` — ${article.sponsor_disclosure}` : ''}</div>}
            {article.cover_image_url && <div className="aspect-[16/9] bg-ink-100 rounded-xl overflow-hidden mb-6"><img src={article.cover_image_url} alt={article.cover_image_alt||article.title} className="w-full h-full object-cover" /></div>}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {cat && <a href={`/${cat.slug}`} className="badge text-white" style={{background:cat.color}}>{cat.name}</a>}
              {article.is_featured && <span className="badge badge-featured">Featured</span>}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight text-ink-950 mb-3">{article.title}</h1>
            {article.excerpt && <p className="text-ink-500 text-lg leading-relaxed mb-4 border-l-4 border-accent pl-4">{article.excerpt}</p>}
            <div className="flex flex-wrap items-center gap-4 text-sm text-ink-400 pb-5 border-b border-ink-100 mb-7">
              <span className="font-medium text-ink-700">{article.author_name}</span><span>·</span>
              <span>{formatDate(article.published_at||article.created_at)}</span><span>·</span>
              <span>{article.reading_time_min} min read</span><span>·</span>
              <span>{article.view_count.toLocaleString()} views</span>
            </div>
            <div className="article-body" dangerouslySetInnerHTML={{__html:content}} />
            <AdSlot position="inline" className="my-8" />
            {tags.length>0 && (
              <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-ink-100">
                <span className="text-xs font-semibold text-ink-500 uppercase tracking-wide mr-1">Tags:</span>
                {tags.map(({tags:tag}) => <a key={tag.slug} href={`/tag/${tag.slug}`} className="px-3 py-1 bg-ink-50 hover:bg-accent hover:text-white rounded-full text-xs font-medium text-ink-600 transition-colors">{tag.name}</a>)}
              </div>
            )}
          </article>
          <aside className="space-y-6"><AdSlot position="sidebar" className="sticky top-20" /></aside>
        </div>
        {(related||[]).length>0 && (
          <div className="mt-12 pt-8 border-t border-ink-100">
            <h2 className="text-2xl font-bold text-ink-950 mb-6">Related Stories</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{(related as Article[]).map(a => <ArticleCard key={a.id} article={a} variant="grid" />)}</div>
          </div>
        )}
      </div>
      <AdSlot position="footer" className="border-t border-ink-100 bg-surface-2 py-3" />
    </>
  )
}
