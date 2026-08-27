// app/(admin)/admin/outreach/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OutreachPanel } from '@/components/admin/OutreachPanel'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'khan.khan.yusuf@gmail.com'

export default async function OutreachPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const isAdmin = user.email === ADMIN_EMAIL

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-950">📋 Outreach</h1>
        <p className="text-sm text-ink-400 mt-1">
          Manage advertiser campaigns and publisher outreach
        </p>
      </div>
      <OutreachPanel isAdmin={isAdmin} />
    </div>
  )
}
