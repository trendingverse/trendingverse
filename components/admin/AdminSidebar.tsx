'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
      <path d={d} />
    </svg>
  )
}

const NAV = [
  { group: 'Overview', items: [
    { label: 'Dashboard',      href: '/admin',               d: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z' },
  ]},
  { group: 'Content', items: [
    { label: 'Articles',       href: '/admin/articles',      d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { label: 'Categories',     href: '/admin/categories',    d: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z' },
    { label: 'Media',          href: '/admin/media',         d: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { label: 'Paste & Enrich', href: '/admin/paste-enrich',  d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { label: 'Video',          href: '/admin/video',         d: 'M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  ]},
  { group: 'AI & SEO', items: [
    { label: 'AI Writer',      href: '/admin/ai-writer',     d: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { label: 'SEO Engine',     href: '/admin/seo',           d: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
    { label: 'Trends',         href: '/admin/trends',        d: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
    { label: 'Authors',        href: '/admin/author-fix',    d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  ]},
  { group: 'Revenue', items: [
    { label: 'Monetization',   href: '/admin/monetization',  d: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Site Scripts',   href: '/admin/monetization/site-scripts', d: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
    { label: 'Earnings',       href: '/admin/revenue',       d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { label: 'Delivery & Fill',href: '/admin/reports',       d: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  ]},
  { group: 'Growth', items: [
    { label: 'Outreach',       href: '/admin/outreach',      d: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ]},
  { group: 'System', items: [
    { label: 'Analytics',      href: '/admin/analytics',     d: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' },
    { label: 'Settings',       href: '/admin/settings',      d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ]},
]
const ADMIN_GROUP  = { group: 'Admin', items: [{ label: 'Publishers', href: '/admin/publishers', d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' }]}
const ADVERTISER   = [{ group: 'Outreach', items: [{ label: 'Publisher Outreach', href: '/admin/outreach', d: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }]}]

export function AdminSidebar({ isAdmin = false, isAdvertiser = false }: { isAdmin?: boolean; isAdvertiser?: boolean }) {
  const path = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const nav = isAdvertiser ? ADVERTISER : isAdmin ? [...NAV, ADMIN_GROUP] : NAV
  useEffect(() => { setMobileOpen(false) }, [path])
  const active = (href: string) => href === '/admin' ? path === '/admin' : path.startsWith(href)

  const Inner = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center h-16 flex-shrink-0 border-b border-ink-100 dark:border-navy-border ${collapsed ? 'justify-center px-3' : 'justify-between px-5'}`}>
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-black">TV</span>
            </div>
            <span className="font-bold text-[15px] tracking-tight text-ink-950 dark:text-white">
              TrendingVerse
            </span>
          </Link>
        )}
        <button onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex w-7 h-7 rounded-lg items-center justify-center text-ink-400 dark:text-slate-600 hover:bg-ink-100 dark:hover:bg-navy-600 transition-all">
          <Icon d={collapsed ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} size={14} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" style={{ scrollbarWidth: 'none' }}>
        {nav.map(s => (
          <div key={s.group}>
            {!collapsed && (
              <p className="text-[10px] font-black uppercase tracking-[0.15em] px-2 mb-2 text-ink-400 dark:text-slate-700">
                {s.group}
              </p>
            )}
            <div className="space-y-0.5">
              {s.items.map(item => {
                const on = active(item.href)
                return (
                  <Link key={item.href} href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={[
                      'group relative flex items-center gap-3 rounded-xl text-sm transition-all duration-150',
                      collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
                      on
                        ? 'bg-accent/8 text-accent font-semibold dark:bg-accent/10 dark:text-red-400'
                        : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900 font-medium dark:text-slate-500 dark:hover:bg-navy-600 dark:hover:text-slate-100',
                    ].join(' ')}>
                    {on && !collapsed && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-accent dark:bg-red-400" />
                    )}
                    <span className={`flex-shrink-0 ${on ? 'text-accent dark:text-red-400' : 'text-ink-400 group-hover:text-ink-600 dark:text-slate-600 dark:group-hover:text-slate-400'} transition-colors`}>
                      <Icon d={item.d} size={16} />
                    </span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="flex-shrink-0 px-3 py-3 border-t border-ink-100 dark:border-navy-border">
        <a href="/" target="_blank" rel="noopener noreferrer"
          title={collapsed ? 'View Site' : undefined}
          className={`flex items-center gap-3 rounded-xl text-xs text-ink-400 hover:text-ink-700 hover:bg-ink-100 dark:text-slate-600 dark:hover:text-slate-300 dark:hover:bg-navy-600 transition-all ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}`}>
          <Icon d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" size={14} />
          {!collapsed && <span className="font-medium">View Site</span>}
        </a>
      </div>
    </div>
  )

  return (
    <>
      <button onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 w-9 h-9 rounded-xl bg-white dark:bg-navy-700 border border-ink-200 dark:border-navy-border shadow-sm flex items-center justify-center">
        <Icon d={mobileOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} size={16} />
      </button>

      {mobileOpen && <div className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setMobileOpen(false)} />}

      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 bg-white dark:bg-navy-900 border-r border-ink-200 dark:border-navy-border shadow-2xl w-64 transform transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Inner />
      </aside>

      <aside className={`hidden lg:flex flex-col bg-white dark:bg-navy-900 border-r border-ink-100 dark:border-navy-border flex-shrink-0 transition-all duration-200 ${collapsed ? 'w-[60px]' : 'w-60'}`}>
        <Inner />
      </aside>
    </>
  )
}
