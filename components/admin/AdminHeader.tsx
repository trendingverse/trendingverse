'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { useTheme } from './ThemeProvider'
import Link from 'next/link'

const TITLES: Record<string, string> = {
  '/admin':'Dashboard','/admin/articles':'Articles','/admin/articles/new':'New Article',
  '/admin/categories':'Categories','/admin/media':'Media','/admin/paste-enrich':'Paste & Enrich',
  '/admin/video':'Video','/admin/ai-writer':'AI Writer','/admin/seo':'SEO Engine',
  '/admin/trends':'Trends','/admin/author-fix':'Authors','/admin/monetization':'Monetization',
  '/admin/monetization/site-scripts':'Site Scripts','/admin/revenue':'Earnings',
  '/admin/reports':'Delivery & Fill','/admin/outreach':'Outreach',
  '/admin/publishers':'Publishers','/admin/analytics':'Analytics','/admin/settings':'Settings',
}

function Icon({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
      <path d={d} />
    </svg>
  )
}

export function AdminHeader({ email }: { email: string }) {
  const [menu, setMenu]           = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const router   = useRouter()
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const title   = TITLES[pathname] ?? 'Admin'
  const initial = email[0]?.toUpperCase() ?? 'A'

  const crumbs = pathname !== '/admin'
    ? pathname.split('/').filter(Boolean).map((seg, i, arr) => ({
        label: TITLES['/' + arr.slice(0, i + 1).join('/')] ?? seg.replace(/-/g, ' '),
        href: '/' + arr.slice(0, i + 1).join('/'),
        isLast: i === arr.length - 1,
      }))
    : null

  async function logout() { await createClient().auth.signOut(); router.push('/login') }
  async function sendReset() {
    await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/admin/reset-password` })
    setResetSent(true)
  }

  return (
    <header className="h-16 flex items-center justify-between px-6 flex-shrink-0 bg-white dark:bg-navy-900 border-b border-ink-100 dark:border-navy-border gap-4">

      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        {crumbs ? (
          <nav className="flex items-center gap-1.5 text-sm min-w-0">
            {crumbs.map((c, i) => (
              <span key={c.href} className="flex items-center gap-1.5 min-w-0">
                {i > 0 && <span className="text-ink-300 dark:text-navy-500 text-xs">/</span>}
                {c.isLast
                  ? <span className="font-semibold text-ink-900 dark:text-white truncate">{c.label}</span>
                  : <Link href={c.href} className="text-ink-400 hover:text-ink-700 dark:text-slate-500 dark:hover:text-slate-300 transition-colors capitalize truncate">{c.label}</Link>}
              </span>
            ))}
          </nav>
        ) : (
          <h1 className="text-[15px] font-bold text-ink-950 dark:text-white">{title}</h1>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 flex-shrink-0">

        <Link href="/admin/articles/new"
          className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-white bg-accent hover:bg-accent-hover transition-colors shadow-sm">
          <Icon d="M12 4v16m8-8H4" size={13} />
          New Article
        </Link>

        {/* Theme toggle */}
        <button onClick={toggle} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-ink-400 dark:text-slate-500 hover:bg-ink-100 dark:hover:bg-navy-700 hover:text-ink-700 dark:hover:text-slate-300 transition-all border border-ink-200 dark:border-navy-border">
          {theme === 'dark'
            ? <Icon d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" size={15} />
            : <Icon d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" size={15} />}
        </button>

        {/* User */}
        <div className="relative">
          <button onClick={() => setMenu(!menu)}
            className="flex items-center gap-2 pl-1 pr-2.5 py-1.5 rounded-xl hover:bg-ink-100 dark:hover:bg-navy-700 transition-colors">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center text-white text-xs font-black flex-shrink-0">
              {initial}
            </div>
            <div className="hidden sm:block text-left min-w-0">
              <p className="text-[13px] font-semibold text-ink-800 dark:text-slate-200 truncate max-w-[120px]">{email.split('@')[0]}</p>
              <p className="text-[10px] text-ink-400 dark:text-slate-600 -mt-0.5">Admin</p>
            </div>
            <Icon d="M19 9l-7 7-7-7" size={12} />
          </button>

          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-12 w-64 rounded-2xl border border-ink-100 dark:border-navy-border bg-white dark:bg-navy-800 shadow-xl z-20 overflow-hidden">
                <div className="px-4 py-3.5 border-b border-ink-50 dark:border-navy-border">
                  <p className="text-[10px] font-black uppercase tracking-widest text-ink-400 dark:text-slate-600">Account</p>
                  <p className="text-sm font-semibold text-ink-900 dark:text-white truncate mt-0.5">{email}</p>
                </div>
                <div className="p-2">
                  {!showReset ? (
                    <button onClick={() => setShowReset(true)}
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-ink-700 dark:text-slate-300 hover:bg-ink-50 dark:hover:bg-navy-700 transition-colors">
                      <Icon d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" size={14} />
                      Reset password
                    </button>
                  ) : resetSent ? (
                    <p className="px-3 py-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">✓ Reset email sent</p>
                  ) : (
                    <div className="px-3 py-2 space-y-2">
                      <p className="text-xs text-ink-500 dark:text-slate-500">Send reset to <strong className="dark:text-slate-300">{email}</strong>?</p>
                      <div className="flex gap-2">
                        <button onClick={sendReset} className="btn-primary btn-xs">Send</button>
                        <button onClick={() => setShowReset(false)} className="btn-secondary btn-xs">Cancel</button>
                      </div>
                    </div>
                  )}
                  <div className="border-t border-ink-50 dark:border-navy-border mt-1 pt-1">
                    <button onClick={logout}
                      className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" size={14} />
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
