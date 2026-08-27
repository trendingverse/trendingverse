'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

/* ─── Nav structure ───────────────────────────────────────────────── */
const NAV = [
  {
    group: 'Overview',
    items: [
      { label: 'Dashboard',   href: '/admin',                     icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    ],
  },
  {
    group: 'Content',
    items: [
      { label: 'Articles',    href: '/admin/articles',            icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      { label: 'Categories',  href: '/admin/categories',          icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
      { label: 'Media',       href: '/admin/media',               icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { label: 'Paste & Enrich', href: '/admin/paste',           icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
      { label: 'Video',       href: '/admin/video',               icon: 'M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
    ],
  },
  {
    group: 'AI & SEO',
    items: [
      { label: 'AI Writer',   href: '/admin/ai-writer',           icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
      { label: 'SEO Engine',  href: '/admin/seo',                 icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
      { label: 'Trends',      href: '/admin/trends',              icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
      { label: 'Authors',     href: '/admin/authors',             icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    ],
  },
  {
    group: 'Monetization',
    items: [
      { label: 'Overview',        href: '/admin/monetization',             icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { label: 'Ad Networks',     href: '/admin/monetization/ad-networks', icon: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0' },
      { label: 'Direct Campaigns',href: '/admin/monetization/direct',      icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },
      { label: 'ads.txt',         href: '/admin/monetization/ads-txt',     icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
    ],
  },
  {
    group: 'Ad Performance',
    items: [
      { label: 'Earnings',        href: '/admin/revenue',  icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
      { label: 'Delivery & Fill', href: '/admin/reports',  icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
    ],
  },
  {
    group: 'Growth',
    items: [
      { label: 'Outreach',    href: '/admin/outreach',     icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    ],
  },
  {
    group: 'System',
    items: [
      { label: 'Analytics',   href: '/admin/analytics',    icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' },
      { label: 'View Site',   href: '/',                   icon: 'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14', external: true },
    ],
  },
]

/* ─── Icon ─────────────────────────────────────────────────────────── */
function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
      <path d={d} />
    </svg>
  )
}

/* ─── NavItem ──────────────────────────────────────────────────────── */
function NavItem({ item, active }: { item: typeof NAV[0]['items'][0]; active: boolean }) {
  const base = 'group flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 relative'
  const activeClass = 'bg-red-500/10 text-white'
  const inactiveClass = 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]'

  const el = (
    <span className={`${base} ${active ? activeClass : inactiveClass}`}>
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-red-500 rounded-r-full" />
      )}
      <span className={`flex-shrink-0 transition-colors ${active ? 'text-red-400' : 'text-slate-600 group-hover:text-slate-400'}`}>
        <Icon d={item.icon} />
      </span>
      <span className="truncate">{item.label}</span>
      {item.external && (
        <svg className="ml-auto flex-shrink-0 text-slate-700" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </span>
  )

  if (item.external) {
    return <a href={item.href} target="_blank" rel="noopener noreferrer">{el}</a>
  }
  return <Link href={item.href}>{el}</Link>
}

/* ─── Main Sidebar ─────────────────────────────────────────────────── */
export function AdminSidebar() {
  const pathname = usePathname()
  const [revenue, setRevenue] = useState<string | null>(null)

  // Fetch today's revenue for the bottom widget
  useEffect(() => {
    fetch('/api/mediation/revenue-summary')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.today_revenue != null) {
          setRevenue(`$${Number(d.today_revenue).toFixed(4)}`)
        }
      })
      .catch(() => {})
  }, [])

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <aside
      className="flex flex-col h-screen flex-shrink-0 select-none"
      style={{
        width: 224,
        background: '#070c18',
        borderRight: '1px solid #131f33',
      }}
    >
      {/* ── Logo ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 h-[56px] flex-shrink-0" style={{ borderBottom: '1px solid #131f33' }}>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-xs"
          style={{ background: 'linear-gradient(135deg, #e63030 0%, #991b1b 100%)' }}
        >
          TV
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white leading-none truncate">TrendingVerse</p>
          <p className="text-[10px] text-slate-600 mt-0.5 leading-none">Admin Console</p>
        </div>
      </div>

      {/* ── Nav ──────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4" style={{ scrollbarWidth: 'none' }}>
        {NAV.map(section => (
          <div key={section.group}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700">
              {section.group}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavItem key={item.href} item={item} active={isActive(item.href)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Revenue widget ───────────────────────────── */}
      <div className="flex-shrink-0 mx-3 mb-3 rounded-lg p-3" style={{ background: '#0d1726', border: '1px solid #131f33' }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Today&apos;s Revenue</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <p className="text-base font-mono font-bold text-emerald-400">
          {revenue ?? '—'}
        </p>
        <Link href="/admin/revenue" className="text-[11px] text-slate-600 hover:text-red-400 transition-colors mt-1 block">
          View earnings →
        </Link>
      </div>

      {/* ── User footer ──────────────────────────────── */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0"
        style={{ borderTop: '1px solid #131f33' }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
          style={{ background: 'linear-gradient(135deg, #dc2626, #7c3aed)' }}
        >
          Y
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-slate-300 truncate">Aizal Wasira</p>
          <p className="text-[10px] text-slate-600 truncate">Admin</p>
        </div>
        <Link
          href="/api/auth/signout"
          className="flex-shrink-0 text-slate-700 hover:text-slate-400 transition-colors"
          title="Sign out"
        >
          <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </div>
    </aside>
  )
}
