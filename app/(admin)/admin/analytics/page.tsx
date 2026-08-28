import { createClient } from '@/lib/supabase/server'
import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard'
import { GSCDashboard } from '@/components/admin/GSCDashboard'
import { GA4Dashboard } from '@/components/admin/GA4Dashboard'
import { Suspense } from 'react'
import Link from 'next/link'

const PLANS_WITH_GSC_GA4 = ['growth', 'pro', 'byoak', 'agency']

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get plan — default to 'byoak' for admin so they see everything
  const { data: profile } = await supabase
    .from('user_profiles').select('plan').eq('id', user?.id || '').single()
  const plan = profile?.plan || 'byoak'
  const hasGscGa4 = PLANS_WITH_GSC_GA4.includes(plan)

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">📊 Analytics</h1>
        <p className="text-sm text-ink-400 mt-1">Performance overview, cron history and usage stats</p>
      </div>

      <AnalyticsDashboard />

      <div className="border-t border-ink-100 pt-8">
        <div className="mb-5">
          <h2 className="font-display text-xl font-bold text-ink-950">🔍 Google Search Console</h2>
          <p className="text-sm text-ink-400 mt-1">Clicks, impressions, keyword rankings and Discover traffic</p>
        </div>
        {hasGscGa4 ? (
          <Suspense fallback={<div className="h-24 bg-ink-50 rounded-xl animate-pulse" />}>
            <GSCDashboard />
          </Suspense>
        ) : (
          <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <p className="font-medium text-amber-900 text-sm">Google Search Console requires Growth plan or higher</p>
                <p className="text-xs text-amber-600 mt-0.5">Current plan: <strong>{plan}</strong></p>
              </div>
            </div>
            <Link href="/pricing" className="shrink-0 bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-amber-600">
              Upgrade →
            </Link>
          </div>
        )}
      </div>

      <div className="border-t border-ink-100 pt-8">
        <div className="mb-5">
          <h2 className="font-display text-xl font-bold text-ink-950">📈 Google Analytics 4</h2>
          <p className="text-sm text-ink-400 mt-1">Sessions, pageviews, traffic sources and device breakdown</p>
        </div>
        {hasGscGa4 ? (
          <Suspense fallback={<div className="h-24 bg-ink-50 rounded-xl animate-pulse" />}>
            <GA4Dashboard />
          </Suspense>
        ) : (
          <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔒</span>
              <div>
                <p className="font-medium text-amber-900 text-sm">Google Analytics 4 requires Growth plan or higher</p>
                <p className="text-xs text-amber-600 mt-0.5">Current plan: <strong>{plan}</strong></p>
              </div>
            </div>
            <Link href="/pricing" className="shrink-0 bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-amber-600">
              Upgrade →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
