// app/(admin)/admin/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminHeader } from '@/components/admin/AdminHeader'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'khan.khan.yusuf@gmail.com'

// Non-admin authenticated users (advertisers) can access these paths
const ADVERTISER_ALLOWED = ['/admin/outreach']

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in → login page
  if (!user) redirect('/login')

  const isAdmin = user.email === ADMIN_EMAIL

  if (!isAdmin) {
    // Check if the current path is one advertisers are allowed to see
    const headersList = await headers()
    const pathname = headersList.get('x-pathname') ??
      headersList.get('x-invoke-path') ??
      headersList.get('x-url') ?? ''

    const allowed = ADVERTISER_ALLOWED.some(p => pathname.includes(p))
    if (!allowed) {
      // Not admin, not on an allowed page → send home (no loop)
      redirect('/')
    }
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#070c18' }}>
      <AdminSidebar />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <AdminHeader email={user.email ?? ''} />
        <main className="flex-1 overflow-y-auto" style={{ background: '#07101f' }}>
          <div className="p-6 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
