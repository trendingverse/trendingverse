import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard'
import { GSCDashboard } from '@/components/admin/GSCDashboard'
import { GA4Dashboard } from '@/components/admin/GA4Dashboard'
import { Suspense } from 'react'
import { AdsterraDashboard } from '@/components/admin/AdsterraDashboard'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-10">
      {/* Platform analytics */}
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">📊 Analytics</h1>
        <p className="text-sm text-ink-400 mt-1">Performance overview, cron history and usage stats</p>
      </div>
      <AnalyticsDashboard />

      {/* GSC */}
      <div className="border-t border-ink-100 pt-8">
        <div className="mb-5">
          <h2 className="font-display text-xl font-bold text-ink-950">🔍 Google Search Console</h2>
          <p className="text-sm text-ink-400 mt-1">Clicks, impressions, keyword rankings and Discover traffic</p>
        </div>
        <Suspense fallback={<div className="h-24 bg-ink-50 rounded-xl animate-pulse" />}>
          <GSCDashboard />
        </Suspense>
      </div>

      {/* GA4 */}
      <div className="border-t border-ink-100 pt-8">
        <div className="mb-5">
          <h2 className="font-display text-xl font-bold text-ink-950">📈 Google Analytics 4</h2>
          <p className="text-sm text-ink-400 mt-1">Sessions, pageviews, traffic sources and device breakdown</p>
        </div>
        <Suspense fallback={<div className="h-24 bg-ink-50 rounded-xl animate-pulse" />}>
          <GA4Dashboard />
        </Suspense>
      </div>
      {/* Adsterra Revenue */}
<div className="border-t border-ink-100 pt-8">
  <div className="mb-5">
    <h2 className="font-display text-xl font-bold text-ink-950">💰 Adsterra Revenue</h2>
    <p className="text-sm text-ink-400 mt-1">Live revenue, impressions, CTR and eCPM from Adsterra</p>
  </div>
  <AdsterraDashboard />
</div>
    </div>
  )
}
