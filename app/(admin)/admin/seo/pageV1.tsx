import { createClient } from '@/lib/supabase/server'
import { SEOPanel } from '@/components/admin/SEOPanel'
export default async function SEOPage() {
  const supabase = await createClient()
  const { data: articles } = await supabase.from('articles').select('id,title,slug,seo_score,seo_title,meta_description,focus_keyword,keywords,cover_image_url,word_count,status').order('seo_score',{ascending:true})
  return (<div><div className="mb-6"><h1 className="text-2xl font-bold text-ink-950">SEO Engine</h1><p className="text-sm text-ink-400">Monitor and improve SEO scores across all articles.</p></div><SEOPanel articles={articles||[]} /></div>)
}
