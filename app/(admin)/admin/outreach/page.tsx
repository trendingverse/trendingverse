// app/(admin)/admin/outreach/page.tsx
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { OutreachPanel } from '@/components/admin/OutreachPanel'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export default async function OutreachPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: profile } = await admin.from('user_profiles').select('role').eq('id', user.id).single()
  const isAdmin = user.email === ADMIN_EMAIL
  const isAdvertiser = profile?.role === 'advertiser'

  if (!isAdmin && !isAdvertiser) redirect('/admin')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">📋 Publisher Outreach</h1>
        <p className="text-sm text-ink-400 mt-1">
          Paste campaign briefs — AI matches publishers, drafts emails and tracks outreach
        </p>
      </div>
      <OutreachPanel isAdmin={isAdmin} />
    </div>
  )
}
