import { createClient } from '@/lib/supabase/server'
import { ArticleManager } from '@/components/admin/ArticleManager'
import { WordPressPublisher } from '@/components/admin/WordPressPublisher'

export default async function ArticlesPage() {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Filter articles by user_id — each publisher sees only their own
  const [{ data: articles }, { data: categories }] = await Promise.all([
    supabase.from('articles')
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
