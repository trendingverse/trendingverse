import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ArticleManager } from '@/components/admin/ArticleManager'

export default async function ArticlesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: articles }, { data: categories }] = await Promise.all([
    supabase
      .from('articles')
      .select('id, title, slug, status, is_featured, is_sponsored, sponsor_name, view_count, seo_score, word_count, published_at, created_at, updated_at, category_name, author_name')
      .order('created_at', { ascending: false }),
    supabase.from('categories').select('id, name, slug').order('name'),
  ])

  const mapped = articles || []

  return (
    <div className="space-y-6">
      <ArticleManager articles={mapped} categories={categories || []} />
    </div>
  )
}
