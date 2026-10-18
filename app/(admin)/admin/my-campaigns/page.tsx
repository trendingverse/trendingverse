import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PublisherDirectAdsPanel } from '@/components/admin/PublisherDirectAdsPanel'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export default async function MyCampaignsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Admins don't need this page — they have /admin/direct-ads
  const isAdmin = user.email === ADMIN_EMAIL
  if (isAdmin) redirect('/admin/direct-ads')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">🎯 My Campaigns</h1>
        <p className="text-sm text-ink-400 mt-1">Direct ad campaigns assigned to your site by the network.</p>
      </div>
      <PublisherDirectAdsPanel publisherEmail={user.email!} />
    </div>
  )
}
