// app/(admin)/admin/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { ThemeProvider } from '@/components/admin/ThemeProvider'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

// Inline script — runs before React, prevents flash of wrong theme
const themeScript = `
  (function(){
    try {
      var t = localStorage.getItem('tv-theme') || 'dark';
      document.documentElement.classList.toggle('dark', t === 'dark');
    } catch(e) {
      document.documentElement.classList.add('dark');
    }
  })();
`

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const isAdmin = user.email === ADMIN_EMAIL

  let isAdvertiser = false
  if (!isAdmin) {
    try {
      const { createClient: svc } = await import('@supabase/supabase-js')
      const admin = svc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      const { data: profile } = await admin.from('user_profiles').select('role').eq('id', user.id).single()
      isAdvertiser = profile?.role === 'advertiser'
    } catch { /* default false */ }
  }

  return (
    <>
      {/* Runs before hydration — sets dark class instantly, no flash */}
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <ThemeProvider>
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
          <AdminSidebar isAdmin={isAdmin} isAdvertiser={isAdvertiser} />
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <AdminHeader email={user.email ?? ''} isAdmin={isAdmin} isAdvertiser={isAdvertiser} />
            <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
              <div className="p-6 max-w-7xl mx-auto">
                {children}
              </div>
            </main>
          </div>
        </div>
      </ThemeProvider>
    </>
  )
}
