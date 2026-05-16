import { createClient } from '@/lib/supabase/server'
import { ArticleEditor } from '@/components/admin/ArticleEditor'
export default async function NewArticlePage() {
  const supabase = await createClient()
  const [{ data: categories }, { data: tags }] = await Promise.all([
    supabase.from('categories').select('id,name,slug,color').order('name'),
    supabase.from('tags').select('id,name,slug').order('name'),
  ])
  return (<div><div className="mb-6"><h1 className="text-2xl font-bold text-ink-950">New Article</h1><p className="text-sm text-ink-400">Create an article or use AI to generate one.</p></div><ArticleEditor categories={categories||[]} tags={tags||[]} /></div>)
}
