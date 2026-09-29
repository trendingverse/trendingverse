// app/(admin)/admin/revenue/page.tsx — v2
// Admin sees every network; a publisher sees only their own earnings (no network names).
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RevenueDashboard } from '@/components/admin/RevenueDashboard'
import { PublisherEarnings } from '@/components/admin/PublisherEarnings'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export default async function RevenuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const isAdmin = user.email === ADMIN_EMAIL

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">{isAdmin ? '💵 Network Revenue' : '💵 Your Earnings'}</h1>
        <p className="text-sm text-ink-400 mt-1">
          {isAdmin
            ? 'Revenue from every ad network — synced from reporting APIs or added manually. Filter by network, site and date.'
            : 'Ad earnings from your site(s), after your revenue share. Filter by date and download as CSV.'}
        </p>
      </div>
      {isAdmin ? <RevenueDashboard /> : <PublisherEarnings />}
    </div>
  )
}
