// app/(admin)/admin/reporting-apis/page.tsx
// Admin-only: set up each ad network's reporting API for the Earnings sync.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ReportingApis } from '@/components/admin/ReportingApis'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export default async function ReportingApisPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (user.email !== ADMIN_EMAIL) redirect('/admin')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">🔌 Reporting APIs</h1>
        <p className="text-sm text-ink-400 mt-1">
          Connect each ad network’s reporting API so its revenue appears in <Link href="/admin/revenue" className="text-blue-600 hover:underline">Earnings</Link>.
          Test before saving — nothing is stored until you click Save.
        </p>
      </div>
      <ReportingApis />
    </div>
  )
}
