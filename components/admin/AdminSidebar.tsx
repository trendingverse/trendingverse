// components/admin/AdminSidebar.tsx
'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
type Role = 'admin' | 'publisher' | 'advertiser'
// Advertiser only sees outreach
const advertiserNav = [
  { label: 'Outreach', items: [
    { href: '/admin/outreach', label: 'Publisher Outreach', icon: '📋' },
  ]},
]
const baseNav = [
  { label: 'Overview', items: [
    { href: '/admin', label: 'Dashboard', icon: '◉' },
  ]},
  { label: 'Content', items: [
    { href: '/admin/articles', label: 'Articles', icon: '▤' },
    { href: '/admin/categories', label: 'Categories', icon: '◼' },
    { href: '/admin/media', label: 'Media', icon: '◧' },
    { href: '/admin/paste-enrich', label: 'Paste & Enrich', icon: '📋' },
  ]},
  { label: 'AI & SEO', items: [
    { href: '/admin/ai-writer', label: 'AI Writer', icon: '✦' },
    { href: '/admin/seo', label: 'SEO Engine', icon: '◈' },
    { href: '/admin/trends', label: 'Trends', icon: '🔥' },
  ]},
  // ── MONETIZATION: two clear jobs — "set up serving" and "see performance" ──
  // Publisher-visible base item is the Monetization overview; admins get the
  // full set split into Ad Serving (setup) and Ad Performance (reports) below.
  { label: 'Monetization', items: [
    { href: '/admin/monetization', label: 'Overview', icon: '◎' },
  ]},
  { label: 'System', items: [
    { href: '/admin/analytics', label: 'Analytics', icon: '📊' },
    { href: '/admin/settings', label: 'Settings', icon: '⚙' },
  ]},
]
// Admin-only additions. NOTE: "Monetization" section now holds the SETUP tools
// (what serves where). Reporting lives in its own "Ad Performance" section so
// users never confuse "configure ads" with "view results".
const adminExtraItems: Record<string, { href: string; label: string; icon: string }[]> = {
  'Content': [{ href: '/admin/video', label: 'Video', icon: '🎬' }],
  'AI & SEO': [{ href: '/admin/author-fix', label: 'Author & Category', icon: '👤' }],
  // Ad SERVING setup — "what serves, and where"
  'Monetization': [
    { href: '/admin/partners', label: 'Ad Networks', icon: '🔌' },
    { href: '/admin/direct-ads', label: 'Direct Campaigns', icon: '🎯' },
    { href: '/admin/ads-txt', label: 'ads.txt', icon: '🔐' },
  ],
  'System': [
    { href: '/admin/audience', label: 'Audience', icon: '👥' },
    { href: '/admin/advertisers', label: 'Advertisers', icon: '🏢' },
  ],
}
// A NEW dedicated reporting section (admin only) — all "how is it doing" in one
// place, each renamed so its distinct purpose is unambiguous:
//   Earnings      = what networks PAY (their reporting APIs)      -> /admin/revenue
//   Delivery & Fill = the waterfall: requests, fills, viewability -> /admin/reports
const adminPerformanceNav = {
  label: 'Ad Performance',
  items: [
    { href: '/admin/revenue', label: 'Earnings', icon: '💵' },
    { href: '/admin/reports', label: 'Delivery & Fill', icon: '📊' },
  ],
}
// Sales / business development — moved OUT of monetization (it isn't revenue
// reporting, it's outreach).
const adminGrowthNav = {
  label: 'Growth',
  items: [
    { href: '/admin/outreach', label: 'Outreach', icon: '📋' },
  ],
}
const adminNav = {
  label: 'Admin',
  items: [
    { href: '/admin/publishers', label: 'Publishers', icon: '👥' },
  ]
}
export function AdminSidebar({ isAdmin = false, role = 'publisher' }: { isAdmin?: boolean; role?: Role }) {
  const path = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  // Advertisers get a completely separate minimal nav
  const nav = role === 'advertiser'
    ? advertiserNav
    : (() => {
        const sections = baseNav.map(section => {
          if (isAdmin && adminExtraItems[section.label]) {
            return { ...section, items: [...section.items, ...adminExtraItems[section.label]] }
          }
          return section
        })
        if (!isAdmin) return sections
        // Insert Ad Performance + Growth right after Monetization for a logical
        // flow: set up serving -> see performance -> grow. Then System, Admin.
        const out: typeof sections = []
        for (const section of sections) {
          out.push(section)
          if (section.label === 'Monetization') {
            out.push(adminPerformanceNav as any)
            out.push(adminGrowthNav as any)
          }
        }
        return [...out, adminNav]
      })()
  useEffect(() => { setMobileOpen(false) }, [path])
  const SidebarContent = () => (
    <>
      <div className={`h-14 px-4 border-b border-ink-100 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <Link href="/" className="font-display font-bold text-lg text-ink-950">
            Trending<span className="text-accent">Verse</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex w-7 h-7 rounded-lg bg-ink-50 hover:bg-ink-100 items-center justify-center text-ink-500 transition-colors text-sm"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>
      {/* Role badge for non-admin users */}
      {!collapsed && role === 'advertiser' && (
        <div className="mx-3 mt-3 px-3 py-2 bg-violet-50 border border-violet-100 rounded-lg">
          <p className="text-xs font-semibold text-violet-700">🏢 Advertiser</p>
          <p className="text-[10px] text-violet-400 mt-0.5">Campaign outreach access</p>
        </div>
      )}
      <nav className="flex-1 p-2 space-y-4 overflow-y-auto">
        {nav.map(section => (
          <div key={section.label}>
            {!collapsed && (
              <p className="text-[10px] font-bold text-ink-300 uppercase tracking-widest px-2 mb-1">
                {section.label}
              </p>
            )}
            {section.items.map(item => {
              const active = item.href === '/admin'
                ? path === '/admin'
                : path.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`admin-nav-item ${active ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}
                >
                  <span className="text-sm w-4 text-center shrink-0">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="p-2 border-t border-ink-100">
        <a href="/" target="_blank" title={collapsed ? 'View Site' : undefined}
          className={`admin-nav-item text-xs ${collapsed ? 'justify-center px-2' : ''}`}>
          <span>↗</span>
          {!collapsed && <span>View Site</span>}
        </a>
      </div>
    </>
  )
  return (
    <>
      <button onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-3 left-3 z-50 w-9 h-9 rounded-xl bg-white border border-ink-100 shadow flex items-center justify-center text-ink-700">
        {mobileOpen ? '✕' : '☰'}
      </button>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/30 z-40" onClick={() => setMobileOpen(false)} />
      )}
      <aside className={`lg:hidden fixed top-0 left-0 h-full w-56 bg-white border-r border-ink-100 flex flex-col z-50 transform transition-transform ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </aside>
      <aside className={`hidden lg:flex flex-col bg-white border-r border-ink-100 overflow-y-auto transition-all duration-200 ${collapsed ? 'w-14' : 'w-56'} shrink-0`}>
        <SidebarContent />
      </aside>
    </>
  )
}
