import { createClient } from '@/lib/supabase/server'
import { ArticleManager } from '@/components/admin/ArticleManager'
export default async function ArticlesPage() {
  const supabase = await createClient()
  const [{ data: articles }, { data: categories }] = await Promise.all([
    supabase.from('articles').select('id,title,slug,status,is_featured,is_sponsored,category_name,author_name,view_count,seo_score,word_count,published_at,created_at,updated_at').order('created_at',{ascending:false}),
    supabase.from('categories').select('id,name,slug'),
  ])
  return <ArticleManager articles={articles||[]} categories={categories||[]} />
}
