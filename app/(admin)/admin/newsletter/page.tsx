import { createClient } from '@/lib/supabase/server'
import { NewsletterPanel } from '@/components/admin/NewsletterPanel'
export default async function NewsletterPage() {
  const supabase = await createClient()
  const [{ data: subscribers }, { data: campaigns }] = await Promise.all([
    supabase.from('newsletter_subscribers').select('*').order('subscribed_at',{ascending:false}),
    supabase.from('newsletter_campaigns').select('*').order('created_at',{ascending:false}),
  ])
  return (<div><div className="mb-6"><h1 className="text-2xl font-bold text-ink-950">Newsletter</h1><p className="text-sm text-ink-400">Manage subscribers and send campaigns.</p></div><NewsletterPanel subscribers={subscribers||[]} campaigns={campaigns||[]} /></div>)
}
