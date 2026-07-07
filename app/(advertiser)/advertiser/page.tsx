// app/(advertiser)/advertiser/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { AdvertiserDashboard } from '@/components/advertiser/AdvertiserDashboard'

export default async function AdvertiserPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Gate: only advertiser-role accounts
  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: profile } = await admin
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'advertiser') redirect('/admin')

  return (
    <div className="min-h-screen bg-white p-6">
      <AdvertiserDashboard />
    </div>
  )
}
