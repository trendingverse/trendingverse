import { createClient } from '@/lib/supabase/server'
import { CategoryManager } from '@/components/admin/CategoryManager'
export default async function CategoriesPage() {
  const supabase = await createClient()
  const { data: categories } = await supabase.from('categories').select('*').order('name')
  return (<div><div className="mb-6"><h1 className="text-2xl font-bold text-ink-950">Categories</h1><p className="text-sm text-ink-400">Organize your content by topic.</p></div><CategoryManager categories={categories||[]} /></div>)
}
