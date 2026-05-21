import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">📊 Analytics</h1>
        <p className="text-sm text-ink-400 mt-1">Performance overview, cron history and usage stats</p>
      </div>
      <AnalyticsDashboard />
    </div>
  )
}
