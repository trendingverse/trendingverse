// app/(admin)/admin/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminHeader } from '@/components/admin/AdminHeader'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const isAdmin = user.email === ADMIN_EMAIL

  // Fetch role from user_profiles
  const adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: profile } = await adminClient
    .from('user_profiles')
    .select('role, company_name')
    .eq('id', user.id)
    .single()

  const role: 'admin' | 'publisher' | 'advertiser' = isAdmin
    ? 'admin'
    : (profile?.role as any) || 'publisher'

  return (
    <div className="flex h-screen overflow-hidden bg-surface-3">
      <AdminSidebar isAdmin={isAdmin} role={role} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader email={user.email || ''} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
