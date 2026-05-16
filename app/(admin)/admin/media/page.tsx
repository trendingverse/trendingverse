import { createClient } from '@/lib/supabase/server'
import { MediaManager } from '@/components/admin/MediaManager'
export default async function MediaPage() {
  const supabase = await createClient()
  const { data: media } = await supabase.from('media_assets').select('*').order('created_at',{ascending:false})
  return (<div><div className="mb-6"><h1 className="text-2xl font-bold text-ink-950">Media Library</h1><p className="text-sm text-ink-400">Upload and manage images for your articles.</p></div><MediaManager media={media||[]} /></div>)
}
