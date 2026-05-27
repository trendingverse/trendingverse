import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MonetizationPanel } from '@/components/admin/MonetizationPanel'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export default async function MonetizationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const isAdmin = user.email === ADMIN_EMAIL

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">💰 Monetization</h1>
        <p className="text-sm text-ink-400 mt-1">
          {isAdmin
            ? 'Manage ad units, ads.txt entries, and view all publisher revenue'
            : 'View your ad units, earnings and revenue share'}
        </p>
      </div>
      <MonetizationPanel isAdmin={isAdmin} />
    </div>
  )
}
