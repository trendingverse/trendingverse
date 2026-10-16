import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { ArticleManager } from '@/components/admin/ArticleManager'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export const dynamic = 'force-dynamic'

export default async function ArticlesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const isAdmin = user.email === ADMIN_EMAIL
  const cols = 'id, title, slug, status, is_featured, is_sponsored, sponsor_name, view_count, seo_score, word_count, published_at, created_at, updated_at, category_name, author_name'

  let articles: any[] = []
  let categories: any[] = []

  if (isAdmin) {
    // Admin sees all articles
    const [{ data: arts }, { data: cats }] = await Promise.all([
      supabase.from('articles').select(cols).order('created_at', { ascending: false }),
      supabase.from('categories').select('id, name, slug').order('name'),
    ])
    articles = arts || []
    categories = cats || []
  } else {
    // Publisher sees only their own articles + articles on their sites
    const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: mySites } = await admin.from('sites').select('id').eq('user_id', user.id)
    const siteIds = (mySites || []).map((s: any) => s.id)

    const orClause = siteIds.length
      ? `user_id.eq.${user.id},site_id.in.(${siteIds.join(',')})`
      : `user_id.eq.${user.id}`

    const [{ data: arts }, { data: cats }] = await Promise.all([
      supabase.from('articles').select(cols).or(orClause).order('created_at', { ascending: false }),
      supabase.from('categories').select('id, name, slug').order('name'),
    ])
    articles = arts || []
    categories = cats || []
  }

  return (
    <div className="space-y-6">
      <ArticleManager articles={articles} categories={categories} />
    </div>
  )
}
