// app/(admin)/admin/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminHeader } from '@/components/admin/AdminHeader'

/* ── Admin gate ───────────────────────────────────────────────────── */
// Only this email can access the admin panel
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'khan.khan.yusuf@gmail.com'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // 1. Must be authenticated
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    redirect('/login')
  }

  // 2. Must be the admin — anyone else gets bounced to home
  if (user.email !== ADMIN_EMAIL) {
    redirect('/')
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
