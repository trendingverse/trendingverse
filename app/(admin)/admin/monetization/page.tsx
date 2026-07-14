import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MonetizationPanel } from '@/components/admin/MonetizationPanel'
import { DeliveryHealthBanner } from '@/components/admin/DeliveryHealthBanner'
import { AdsterraDashboard } from '@/components/admin/AdsterraDashboard'
import Link from 'next/link'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
const PLANS_WITH_ADS = ['growth', 'pro', 'byoak', 'agency']

export default async function MonetizationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const isAdmin = user.email === ADMIN_EMAIL
  const { data: profile } = await supabase.from('user_profiles').select('plan').eq('id', user.id).single()
  const plan = profile?.plan || 'free'
  const hasAds = isAdmin || PLANS_WITH_ADS.includes(plan)

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">💰 Monetization</h1>
        <p className="text-sm text-ink-400 mt-1">
          {isAdmin ? 'Manage ad units, publishers and network revenue' : 'Your earnings and ad performance'}
        </p>
      </div>

      {hasAds ? (
        <>
          <div className="border-b border-ink-100 pb-8">
            <div className="mb-5">
              <h2 className="font-display text-xl font-bold text-ink-950">📡 Ad Network Revenue</h2>
              <p className="text-sm text-ink-400 mt-1">
                {isAdmin ? 'Live revenue across all publisher sites' : 'Your earnings from TrendingVerse ad network'}
              </p>
            </div>
            <AdsterraDashboard isAdmin={isAdmin} />
          </div>
          <MonetizationPanel isAdmin={isAdmin} />
        </>
      ) : (
        <div className="card p-8 text-center max-w-lg mx-auto">
          <div className="text-5xl mb-4">💰</div>
          <h2 className="font-bold text-ink-900 text-xl mb-2">Unlock Programmatic Ads</h2>
          <p className="text-ink-500 text-sm mb-6 leading-relaxed">
            Inject ads into all your WordPress articles automatically. Track revenue, manage ad units and earn from your content — starting at ₹399/mo.
          </p>
          <div className="space-y-2 text-left mb-6 max-w-xs mx-auto">
            {[
              'Auto-inject ads into all articles',
              'Revenue dashboard with live stats',
              'TrendingVerse Ads WordPress plugin',
              'Custom revenue splits',
            ].map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-ink-600">
                <span className="text-green-500 font-bold">✓</span> {f}
              </div>
            ))}
          </div>
          <Link href="/pricing" className="inline-block bg-red-500 text-white font-semibold px-6 py-3 rounded-xl hover:bg-red-600 transition-colors">
            Upgrade to Growth →
          </Link>
          <p className="text-xs text-ink-400 mt-3">Starting at ₹399/mo · Cancel anytime</p>
        </div>
      )}
    </div>
  )
}
