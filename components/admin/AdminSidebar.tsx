'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'

/* ── Nav definitions — unchanged logic ─────────────────────── */
const baseNav = [
  { label: 'Overview', items: [
    { href: '/admin',            label: 'Dashboard',    icon: '◉' },
  ]},
  { label: 'Content', items: [
    { href: '/admin/articles',   label: 'Articles',     icon: '▤' },
    { href: '/admin/categories', label: 'Categories',   icon: '◼' },
    { href: '/admin/media',      label: 'Media',        icon: '◧' },
  ]},
  { label: 'AI & SEO', items: [
    { href: '/admin/ai-writer',  label: 'AI Writer',    icon: '✦' },
    { href: '/admin/seo',        label: 'SEO Engine',   icon: '◈' },
    { href: '/admin/trends',     label: 'Trends',       icon: '🔥' },
  ]},
  { label: 'Revenue', items: [
    { href: '/admin/monetization', label: 'Monetization', icon: '◎' },
  ]},
  { label: 'System', items: [
    { href: '/admin/analytics',  label: 'Analytics',    icon: '📊' },
    { href: '/admin/settings',   label: 'Settings',     icon: '⚙' },
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

/* ── Component — only styling changed ──────────────────────── */
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
      {/* Logo */}
      <div className={`h-14 flex items-center shrink-0 border-b border-ink-100/60 ${collapsed ? 'justify-center px-3' : 'justify-between px-4'}`}
        style={{ background: 'linear-gradient(135deg,#fff 0%,#fafafa 100%)' }}>
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
      <nav className="flex-1 py-4 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {nav.map(section => (
          <div key={section.label} className="mb-5">
            {!collapsed && (
              <p className="text-[10px] font-bold text-ink-300 uppercase tracking-[0.12em] px-4 mb-1.5">
                {section.label}
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
                    className={`
                      flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-150
                      ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2'}
                      ${active
                        ? 'bg-accent/8 text-accent'
                        : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                      }
                    `}
                  >
                    <span className={`text-sm w-4 text-center shrink-0 ${active ? 'opacity-100' : 'opacity-60'}`}>
                      {item.icon}
                    </span>
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
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

      {/* Footer */}
      <div className="p-2 border-t border-ink-100/60 shrink-0">
        <a
          href="/"
          target="_blank"
          title={collapsed ? 'View Site' : undefined}
          className={`flex items-center gap-2.5 rounded-lg text-xs text-ink-400 hover:text-ink-700 hover:bg-ink-50 transition-all
            ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2'}`}
        >
          <span className="text-sm">↗</span>
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

      {/* Mobile sidebar */}
      <aside className={`lg:hidden fixed top-0 left-0 h-full w-56 bg-white border-r border-ink-100 flex flex-col z-50 shadow-xl transform transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col bg-white border-r border-ink-100 overflow-hidden transition-all duration-200 shrink-0 ${collapsed ? 'w-14' : 'w-56'}`}>
        <SidebarContent />
      </aside>
    </>
  )
}
