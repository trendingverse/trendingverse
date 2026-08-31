'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'

const baseNav = [
  { label: 'Overview', items: [
    { href: '/admin', label: 'Dashboard', icon: '◉' },
  ]},
  { label: 'Content', items: [
    { href: '/admin/articles', label: 'Articles', icon: '▤' },
    { href: '/admin/categories', label: 'Categories', icon: '◼' },
    { href: '/admin/media', label: 'Media', icon: '◧' },
  ]},
  { label: 'AI & SEO', items: [
    { href: '/admin/ai-writer', label: 'AI Writer', icon: '✦' },
    { href: '/admin/seo', label: 'SEO Engine', icon: '◈' },
    { href: '/admin/trends', label: 'Trends', icon: '🔥' },
  ]},
  { label: 'Revenue', items: [
    { href: '/admin/monetization', label: 'Monetization', icon: '◎' },
  ]},
  { label: 'System', items: [
    { href: '/admin/analytics', label: 'Analytics', icon: '📊' },
    { href: '/admin/settings', label: 'Settings', icon: '⚙' },
  ]},
]

const adminNav = {
  label: 'Admin',
  items: [
    { href: '/admin/publishers', label: 'Publishers', icon: '👥' },
  ]
}

const advertiserNav = [
  { label: 'Outreach', items: [
    { href: '/admin/outreach', label: 'Publisher Outreach', icon: '📋' },
  ]},
]

export function AdminSidebar({ isAdmin = false, isAdvertiser = false }: { isAdmin?: boolean; isAdvertiser?: boolean }) {
  const path = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const nav = isAdvertiser
    ? advertiserNav
    : isAdmin
      ? [...baseNav, adminNav]
      : baseNav

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
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

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
        <a
          href="/"
          target="_blank"
          title={collapsed ? 'View Site' : undefined}
          className={`admin-nav-item text-xs ${collapsed ? 'justify-center px-2' : ''}`}
        >
          <span>↗</span>
          {!collapsed && <span>View Site</span>}
        </a>
      </div>
    </>
  )

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-3 left-3 z-50 w-9 h-9 rounded-xl bg-white border border-ink-100 shadow flex items-center justify-center text-ink-700"
      >
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
