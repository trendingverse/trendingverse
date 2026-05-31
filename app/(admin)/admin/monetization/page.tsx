import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MonetizationPanel } from '@/components/admin/MonetizationPanel'
import { AdsterraDashboard } from '@/components/admin/AdsterraDashboard'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export default async function MonetizationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const isAdmin = user.email === ADMIN_EMAIL

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">💰 Monetization</h1>
        <p className="text-sm text-ink-400 mt-1">
          {isAdmin ? 'Manage ad units, publishers and network revenue' : 'Your earnings and ad performance'}
        </p>
      </div>

      {/* Adsterra Revenue — shown to all, different view per role */}
      <div className="border-b border-ink-100 pb-8">
        <div className="mb-5">
          <h2 className="font-display text-xl font-bold text-ink-950">📡 Ad Network Revenue</h2>
          <p className="text-sm text-ink-400 mt-1">
            {isAdmin ? 'Live revenue across all publisher sites — gross, publisher payouts and platform earnings' : 'Your earnings from TrendingVerse ad network'}
          </p>
        </div>
        <AdsterraDashboard isAdmin={isAdmin} />
      </div>

      {/* Ad management — admin only sees full panel */}
      <MonetizationPanel isAdmin={isAdmin} />
    </div>
  )
}
