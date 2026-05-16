import { createClient } from '@/lib/supabase/server'
import { MonetizationPanel } from '@/components/admin/MonetizationPanel'
export default async function MonetizationPage() {
  const supabase = await createClient()
  const [{ data: adSlots }, { data: affiliates }] = await Promise.all([
    supabase.from('ad_slots').select('*').order('position'),
    supabase.from('affiliate_links').select('*').order('created_at',{ascending:false}),
  ])
  return (<div><div className="mb-6"><h1 className="text-2xl font-bold text-ink-950">Monetization</h1><p className="text-sm text-ink-400">AdSense, affiliate links, and revenue tracking.</p></div><MonetizationPanel adSlots={adSlots||[]} affiliates={affiliates||[]} /></div>)
}
