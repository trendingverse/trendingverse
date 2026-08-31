'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'

function Icon({ d }: { d: string }) {
  return (
    <svg width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
      <path d={d} />
    </svg>
  )
}

/* ── Full nav — all original routes restored ────────────────── */
const baseNav = [
  { group: 'Overview', items: [
    { label: 'Dashboard',      href: '/admin',                          d: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  ]},
  { group: 'Content', items: [
    { label: 'Articles',       href: '/admin/articles',                 d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { label: 'Categories',     href: '/admin/categories',               d: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z' },
    { label: 'Media',          href: '/admin/media',                    d: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { label: 'Paste & Enrich', href: '/admin/paste',                    d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { label: 'Video',          href: '/admin/video',                    d: 'M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  ]},
  { group: 'AI & SEO', items: [
    { label: 'AI Writer',      href: '/admin/ai-writer',                d: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
    { label: 'SEO Engine',     href: '/admin/seo',                      d: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
    { label: 'Trends',         href: '/admin/trends',                   d: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
    { label: 'Authors',        href: '/admin/authors',                  d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  ]},
  { group: 'Monetization', items: [
    { label: 'Overview',          href: '/admin/monetization',             d: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Ad Networks',       href: '/admin/monetization/ad-networks', d: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0' },
    { label: 'Direct Campaigns',  href: '/admin/monetization/direct',      d: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },
    { label: 'ads.txt',           href: '/admin/monetization/ads-txt',     d: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
  ]},
  { group: 'Ad Performance', items: [
    { label: 'Earnings',       href: '/admin/revenue',                  d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { label: 'Delivery & Fill',href: '/admin/reports',                  d: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  ]},
  { group: 'Growth', items: [
    { label: 'Outreach',       href: '/admin/outreach',                 d: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ]},
  { group: 'System', items: [
    { label: 'Analytics',      href: '/admin/analytics',                d: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' },
    { label: 'Settings',       href: '/admin/settings',                 d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ]},
]

const adminOnlyGroup = {
  group: 'Admin',
  items: [
    { label: 'Publishers',    href: '/admin/publishers',              d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  ]
}

const advertiserNav = [
  { group: 'Outreach', items: [
    { label: 'Publisher Outreach', href: '/admin/outreach',            d: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ]},
]

export function AdminSidebar({ isAdmin = false, isAdvertiser = false }: { isAdmin?: boolean; isAdvertiser?: boolean }) {
  const path     = usePathname()
  const [collapsed,  setCollapsed]  = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const nav = isAdvertiser
    ? advertiserNav
    : isAdmin
      ? [...baseNav, adminOnlyGroup]
      : baseNav

  useEffect(() => { setMobileOpen(false) }, [path])

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className={`h-14 flex items-center shrink-0 border-b border-ink-100 ${collapsed ? 'justify-center px-3' : 'justify-between px-4'}`}>
        {!collapsed && (
          <Link href="/" className="font-display font-bold text-lg tracking-tight">
            Trending<span className="text-accent">Verse</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex w-7 h-7 rounded-lg items-center justify-center text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-all text-xs"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {nav.map(section => (
          <div key={section.group} className="mb-4">
            {!collapsed && (
              <p className="text-[10px] font-bold text-ink-300 uppercase tracking-[0.12em] px-4 mb-1">
                {section.group}
              </p>
            )}
            <div className="space-y-0.5 px-2">
              {section.items.map(item => {
                const active = item.href === '/admin'
                  ? path === '/admin'
                  : path.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={[
                      'flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                      collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
                      active
                        ? 'bg-accent/8 text-accent'
                        : 'text-ink-500 hover:bg-ink-50 hover:text-ink-900',
                    ].join(' ')}
                  >
                    <span className={`shrink-0 ${active ? 'text-accent' : 'text-ink-400'}`}>
                      <Icon d={item.d} />
                    </span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && active && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* View Site */}
      <div className="p-2 border-t border-ink-100 shrink-0">
        <a
          href="/"
          target="_blank"
          title={collapsed ? 'View Site' : undefined}
          className={[
            'flex items-center gap-2.5 rounded-lg text-xs text-ink-400 hover:text-ink-700 hover:bg-ink-50 transition-all',
            collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
          ].join(' ')}
        >
          <svg width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {!collapsed && <span>View Site</span>}
        </a>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-3 left-3 z-50 w-9 h-9 rounded-xl bg-white border border-ink-100 shadow-sm flex items-center justify-center text-ink-700 text-sm"
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`lg:hidden fixed top-0 left-0 h-full w-56 bg-white border-r border-ink-100 flex flex-col z-50 shadow-xl transform transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </aside>

      <aside className={`hidden lg:flex flex-col bg-white border-r border-ink-100 overflow-hidden transition-all duration-200 shrink-0 ${collapsed ? 'w-14' : 'w-56'}`}>
        <SidebarContent />
      </aside>
    </>
  )
}
