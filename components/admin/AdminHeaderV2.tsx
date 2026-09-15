'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'

/* ── Page title map — purely visual ────────────────────────── */
const PAGE_TITLES: Record<string, string> = {
  '/admin':                    'Dashboard',
  '/admin/articles':           'Articles',
  '/admin/articles/new':       'New Article',
  '/admin/categories':         'Categories',
  '/admin/media':              'Media Library',
  '/admin/paste-enrich':       'Paste & Enrich',
  '/admin/video':              'Video',
  '/admin/ai-writer':          'AI Writer',
  '/admin/seo':                'SEO Engine',
  '/admin/trends':             'Trends',
  '/admin/authors':            'Authors',
  '/admin/monetization':       'Monetization',
  '/admin/monetization/ad-networks': 'Ad Networks',
  '/admin/monetization/direct':      'Direct Campaigns',
  '/admin/monetization/ads-txt':     'ads.txt',
  '/admin/revenue':            'Earnings',
  '/admin/reports':            'Delivery & Fill',
  '/admin/outreach':           'Publisher Outreach',
  '/admin/publishers':         'Publishers',
  '/admin/analytics':          'Analytics',
  '/admin/settings':           'Settings',
}

/* ── All logic preserved exactly — only layout/styling changed ─ */
export function AdminHeader({ email }: { email: string }) {
  const [showMenu, setShowMenu]   = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const router   = useRouter()
  const pathname = usePathname()

  const pageTitle = PAGE_TITLES[pathname] ?? 'Admin'

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

  const initial = email[0]?.toUpperCase() ?? '?'

  return (
    <header className="h-14 border-b border-ink-100 bg-white flex items-center justify-between px-6 shrink-0 gap-4">

      {/* Page title */}
      <h1 className="font-display font-semibold text-ink-900 text-base truncate">
        {pageTitle}
      </h1>

      {/* Right — user menu */}
      <div className="relative shrink-0">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2.5 text-sm text-ink-600 hover:text-ink-900 transition-colors rounded-lg px-2 py-1.5 hover:bg-ink-50"
        >
          <span className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold shrink-0">
            {initial}
          </span>
          <span className="hidden sm:block text-ink-700 font-medium max-w-[160px] truncate">{email}</span>
          <span className="text-ink-300 text-xs">▾</span>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-11 w-64 bg-white border border-ink-100 rounded-xl shadow-lg z-20 overflow-hidden">
              <div className="px-4 py-3 border-b border-ink-50 bg-ink-50/50">
                <p className="text-[11px] text-ink-400 uppercase tracking-wide font-medium">Signed in as</p>
                <p className="text-sm font-semibold text-ink-900 truncate mt-0.5">{email}</p>
              </div>
              <div className="p-1.5">
                {!showReset ? (
                  <button
                    onClick={() => setShowReset(true)}
                    className="w-full text-left px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <span>🔑</span> Reset password
                  </button>
                ) : resetSent ? (
                  <p className="px-3 py-2 text-xs text-emerald-600 font-medium">✓ Reset email sent — check your inbox</p>
                ) : (
                  <div className="px-3 py-2 space-y-2">
                    <p className="text-xs text-ink-500">Send a reset link to <strong>{email}</strong>?</p>
                    <div className="flex gap-2">
                      <button onClick={handlePasswordReset} className="text-xs px-3 py-1.5 bg-accent text-white rounded-lg font-medium">Send email</button>
                      <button onClick={() => setShowReset(false)} className="text-xs px-3 py-1.5 bg-ink-100 rounded-lg text-ink-600">Cancel</button>
                    </div>
                  </div>
                )}
                <div className="border-t border-ink-50 mt-1 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <span>↩</span> Sign out
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
