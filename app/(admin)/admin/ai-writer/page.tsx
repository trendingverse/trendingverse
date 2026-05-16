import { createClient } from '@/lib/supabase/server'
import { AIWriterPanel } from '@/components/admin/AIWriterPanel'

export default async function AIWriterPage() {
  const supabase = await createClient()
  const { data: categories } = await supabase.from('categories').select('*').order('name')
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-950">✦ AI Writer</h1>
        <p className="text-sm text-ink-400">Generate, rewrite, and enhance articles with Gemini AI.</p>
      </div>
      <AIWriterPanel categories={categories||[]} />
    </div>
  )
}
