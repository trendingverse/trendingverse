'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function AdminHeader({ email }: { email: string }) {
  const [showMenu, setShowMenu] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handlePasswordReset() {
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    })
    setResetSent(true)
  }

  return (
    <header className="h-14 border-b border-ink-100 bg-white flex items-center justify-between px-6 shrink-0">
      <div className="flex-1" />
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 text-sm text-ink-600 hover:text-ink-900 transition-colors"
        >
          <span className="w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold">
            {email[0]?.toUpperCase()}
          </span>
          <span className="hidden sm:block">{email}</span>
          <span className="text-ink-300">▾</span>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-10 w-64 bg-white border border-ink-100 rounded-xl shadow-lg z-20 overflow-hidden">
              <div className="px-4 py-3 border-b border-ink-50">
                <p className="text-xs text-ink-400">Signed in as</p>
                <p className="text-sm font-medium text-ink-900 truncate">{email}</p>
              </div>
              <div className="p-2">
                {!showReset ? (
                  <button
                    onClick={() => setShowReset(true)}
                    className="w-full text-left px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 rounded-lg transition-colors"
                  >
                    🔑 Reset password
                  </button>
                ) : resetSent ? (
                  <p className="px-3 py-2 text-xs text-green-600">✓ Reset email sent! Check your inbox.</p>
                ) : (
                  <div className="px-3 py-2 space-y-2">
                    <p className="text-xs text-ink-500">Send password reset to {email}?</p>
                    <div className="flex gap-2">
                      <button onClick={handlePasswordReset} className="text-xs px-3 py-1.5 bg-accent text-white rounded-lg">Send email</button>
                      <button onClick={() => setShowReset(false)} className="text-xs px-3 py-1.5 bg-ink-100 rounded-lg">Cancel</button>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-1"
                >
                  ↩ Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
