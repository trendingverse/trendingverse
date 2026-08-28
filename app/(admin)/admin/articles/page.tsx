import { createClient } from '@/lib/supabase/server'
import { ArticleManager } from '@/components/admin/ArticleManager'
import { WordPressPublisher } from '@/components/admin/WordPressPublisher'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export default async function ArticlesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAdmin = user?.email === ADMIN_EMAIL

  const [{ data: articles }, { data: categories }] = await Promise.all([
    isAdmin
      // Admin sees ALL articles across all publishers
      ? supabase.from('articles')
          .select('id,title,slug,status,is_featured,is_sponsored,category_name,author_name,view_count,seo_score,word_count,published_at,created_at,updated_at')
          .order('created_at', { ascending: false })
      // Publisher sees only their own
      : supabase.from('articles')
          .select('id,title,slug,status,is_featured,is_sponsored,category_name,author_name,view_count,seo_score,word_count,published_at,created_at,updated_at')
          .eq('user_id', user?.id || '')
          .order('created_at', { ascending: false }),
    supabase.from('categories').select('id,name,slug'),
  ])

  const allArticles = articles || []

  return (
    <div className="space-y-6">
      <WordPressPublisher articles={allArticles} />
      <ArticleManager articles={allArticles} categories={categories || []} />
    </div>
  )
}
