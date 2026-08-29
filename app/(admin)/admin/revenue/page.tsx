import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RevenueDashboard } from '@/components/admin/RevenueDashboard'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export default async function RevenuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (user.email !== ADMIN_EMAIL) redirect('/admin')
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">💵 Network Revenue</h1>
        <p className="text-sm text-ink-400 mt-1">
          Revenue pulled from your ad networks' reporting APIs. Filter by network, site, and date.
        </p>
      </div>
      <RevenueDashboard />
    </div>
  )
}
