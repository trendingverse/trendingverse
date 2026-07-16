import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PartnerManager } from '@/components/admin/PartnerManager'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export default async function PartnersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (user.email !== ADMIN_EMAIL) redirect('/admin')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">🔌 Ad Networks</h1>
        <p className="text-sm text-ink-400 mt-1">
          Register your ad networks and paste the tags you generated for each site, position and size. The waterfall serves them in the order you set.
        </p>
      </div>
      <PartnerManager />
    </div>
  )
}
