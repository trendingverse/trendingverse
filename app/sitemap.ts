import { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendingverse.online'
  const admin = createAdminClient()
  const { data: articles } = await admin.from('articles')
    .select('slug,updated_at').eq('status','published').order('published_at',{ascending:false}).limit(1000)
  const { data: categories } = await admin.from('categories').select('slug,created_at')

  const articleUrls: MetadataRoute.Sitemap = (articles||[]).map(a => ({
    url: `${base}/article/${a.slug}`, lastModified: a.updated_at, changeFrequency: 'weekly', priority: 0.8,
  }))
  const categoryUrls: MetadataRoute.Sitemap = (categories||[]).map(c => ({
    url: `${base}/${c.slug}`, lastModified: c.created_at, changeFrequency: 'daily', priority: 0.6,
  }))
  return [
    { url: base, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/search`, changeFrequency: 'monthly', priority: 0.3 },
    ...categoryUrls, ...articleUrls,
  ]
}
