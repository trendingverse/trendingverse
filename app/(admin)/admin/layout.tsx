// app/(admin)/admin/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminHeader } from '@/components/admin/AdminHeader'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const isAdmin = user.email === ADMIN_EMAIL

  let isAdvertiser = false
  if (!isAdmin) {
    try {
      const { createClient: svc } = require('@supabase/supabase-js')
      const admin = svc(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data } = await admin.from('user_profiles').select('role').eq('id', user.id).single()
      isAdvertiser = data?.role === 'advertiser'
    } catch { /* default false */ }
  }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg)' }}>
      <AdminSidebar isAdmin={isAdmin} isAdvertiser={isAdvertiser} />
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        <AdminHeader email={user.email ?? ''} isAdmin={isAdmin} isAdvertiser={isAdvertiser} />
        <main style={{ flex:1, overflowY:'auto', background:'var(--bg)' }}>
          <div style={{ padding:24, maxWidth:1400, margin:'0 auto' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
