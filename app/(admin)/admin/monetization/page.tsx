import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MonetizationPanel } from '@/components/admin/MonetizationPanel'
import { DeliveryHealthBanner } from '@/components/admin/DeliveryHealthBanner'
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
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">💰 Monetization</h1>
        <p className="text-sm text-ink-400 mt-1">
          {isAdmin ? 'Set up ad serving and manage your ad units' : 'Your ad units and earnings'}
        </p>
      </div>

      {hasAds ? (
        <>
          {isAdmin && <DeliveryHealthBanner />}

          {/* Quick links to the two performance views — so this page ORIENTS
              rather than duplicating the dashboards. Revenue reporting lives in
              Earnings; the waterfall lives in Delivery & Fill. */}
          {isAdmin && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link href="/admin/revenue" className="card p-5 hover:border-ink-300 transition-colors group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-400 mb-1">Performance</p>
                    <h3 className="font-semibold text-ink-900">💵 Earnings</h3>
                    <p className="text-sm text-ink-400 mt-1">Revenue from all ad networks, by site and day.</p>
                  </div>
                  <span className="text-ink-300 group-hover:text-ink-600 transition-colors">→</span>
                </div>
              </Link>
              <Link href="/admin/reports" className="card p-5 hover:border-ink-300 transition-colors group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-400 mb-1">Performance</p>
                    <h3 className="font-semibold text-ink-900">📊 Delivery & Fill</h3>
                    <p className="text-sm text-ink-400 mt-1">Requests, fills by partner, and viewability.</p>
                  </div>
                  <span className="text-ink-300 group-hover:text-ink-600 transition-colors">→</span>
                </div>
              </Link>
            </div>
          )}

          {/* Setup shortcuts for serving config (admin) */}
          {isAdmin && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link href="/admin/partners" className="card p-5 hover:border-ink-300 transition-colors group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-400 mb-1">Setup</p>
                    <h3 className="font-semibold text-ink-900">🔌 Ad Networks</h3>
                    <p className="text-sm text-ink-400 mt-1">Partners, tags, waterfall order and reporting APIs.</p>
                  </div>
                  <span className="text-ink-300 group-hover:text-ink-600 transition-colors">→</span>
                </div>
              </Link>
              <Link href="/admin/direct-ads" className="card p-5 hover:border-ink-300 transition-colors group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-ink-400 mb-1">Setup</p>
                    <h3 className="font-semibold text-ink-900">🎯 Direct Campaigns</h3>
                    <p className="text-sm text-ink-400 mt-1">Your own sold campaigns, served first by priority.</p>
                  </div>
                  <span className="text-ink-300 group-hover:text-ink-600 transition-colors">→</span>
                </div>
              </Link>
            </div>
          )}

          {/* Ad units — the slot definitions the WordPress plugin reads. This is
              SETUP (define where ads appear), kept here under a clear heading. */}
          <div>
            <div className="mb-4">
              <h2 className="font-display text-xl font-bold text-ink-950">🧩 Ad Units</h2>
              <p className="text-sm text-ink-400 mt-1">
                {isAdmin
                  ? 'Define the ad slots (position + size) your sites serve. Each slot fills via the mediation waterfall.'
                  : 'Your ad slots and placements.'}
              </p>
            </div>
            <MonetizationPanel isAdmin={isAdmin} />
          </div>
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
