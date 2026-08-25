'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

/* ─── Breadcrumb map ─────────────────────────────────────────────── */
const PAGE_TITLES: Record<string, string> = {
  '/admin':                              'Dashboard',
  '/admin/articles':                     'Articles',
  '/admin/articles/new':                 'New Article',
  '/admin/categories':                   'Categories',
  '/admin/media':                        'Media Library',
  '/admin/paste':                        'Paste & Enrich',
  '/admin/video':                        'Video',
  '/admin/ai-writer':                    'AI Writer',
  '/admin/seo':                          'SEO Engine',
  '/admin/trends':                       'Trends',
  '/admin/authors':                      'Authors',
  '/admin/monetization':                 'Monetization',
  '/admin/monetization/ad-networks':     'Ad Networks',
  '/admin/monetization/direct':          'Direct Campaigns',
  '/admin/monetization/ads-txt':         'ads.txt',
  '/admin/revenue':                      'Earnings',
  '/admin/reports':                      'Delivery & Fill',
  '/admin/outreach':                     'Outreach',
  '/admin/analytics':                    'Analytics',
}

function getTitle(path: string) {
  if (PAGE_TITLES[path]) return PAGE_TITLES[path]
  if (path.includes('/articles/') && path.includes('/edit')) return 'Edit Article'
  const parts = path.split('/').filter(Boolean)
  if (parts.length >= 2) {
    const parent = PAGE_TITLES[`/${parts.slice(0, -1).join('/')}`]
    if (parent) return parent
  }
  return 'Admin'
}

function getBreadcrumbs(path: string) {
  const crumbs = [{ label: 'TrendingVerse', href: '/admin' }]
  const parts = path.split('/').filter(p => p !== 'admin' && p !== '')
  let acc = '/admin'
  for (const part of parts) {
    acc += `/${part}`
    const title = PAGE_TITLES[acc] ?? part.charAt(0).toUpperCase() + part.slice(1)
    crumbs.push({ label: title, href: acc })
  }
  return crumbs
}

export function AdminHeader({ email }: { email: string }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const [q, setQ] = useState('')
  const title      = getTitle(pathname)
  const crumbs     = getBreadcrumbs(pathname)

  function search(e: React.FormEvent) {
    e.preventDefault()
    if (q.trim()) {
      router.push(`/admin/articles?q=${encodeURIComponent(q.trim())}`)
      setQ('')
    }
  }

  return (
    <header
      className="flex items-center justify-between px-6 flex-shrink-0"
      style={{
        height: 56,
        background: '#070c18',
        borderBottom: '1px solid #131f33',
      }}
    >
      {/* Left: title + breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-[15px] font-semibold text-white whitespace-nowrap">{title}</h1>
        {crumbs.length > 2 && (
          <nav className="hidden sm:flex items-center gap-1 text-[12px] text-slate-600" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <span key={c.href} className="flex items-center gap-1">
                {i > 0 && <span className="text-slate-800">/</span>}
                {i === crumbs.length - 1 ? (
                  <span className="text-slate-500">{c.label}</span>
                ) : (
                  <Link href={c.href} className="hover:text-slate-400 transition-colors">{c.label}</Link>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>

      {/* Right: search + actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Search */}
        <form onSubmit={search} className="hidden md:flex items-center">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px]" style={{ background: '#0e1726', border: '1px solid #1a2840' }}>
            <svg width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="text-slate-600 flex-shrink-0" aria-hidden>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search articles…"
              className="bg-transparent outline-none text-slate-300 placeholder:text-slate-700 w-36"
              style={{ fontSize: 13 }}
            />
            <kbd className="text-[10px] text-slate-700 font-mono">⌘K</kbd>
          </div>
        </form>

        {/* New Article */}
        <Link
          href="/admin/articles/new"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-white transition-colors"
          style={{ background: '#dc2626' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#b91c1c')}
          onMouseLeave={e => (e.currentTarget.style.background = '#dc2626')}
        >
          <svg width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
            <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
          </svg>
          New
        </Link>

        {/* Trends */}
        <Link
          href="/admin/trends"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-400 hover:text-white transition-colors"
          style={{ background: '#0e1726', border: '1px solid #1a2840' }}
        >
          <svg width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Trends
        </Link>

        {/* User dot */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 cursor-default"
          style={{ background: 'linear-gradient(135deg, #dc2626, #7c3aed)' }}
          title={email}
        >
          {email ? email[0].toUpperCase() : 'A'}
        </div>
      </div>
    </header>
  )
}
