'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const nav = [
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
  ]},
  { label: 'Revenue', items: [
    { href: '/admin/monetization', label: 'Monetization', icon: '◎' },
  ]},
  { label: 'System', items: [
    { href: '/admin/settings', label: 'Settings', icon: '⚙' },
  ]},
]

export function AdminSidebar() {
  const path = usePathname()
  return (
    <aside className="w-56 shrink-0 bg-white border-r border-ink-100 flex flex-col overflow-y-auto">
      <div className="h-14 px-4 border-b border-ink-100 flex items-center">
        <Link href="/" className="font-display font-bold text-lg text-ink-950">
          Trending<span className="text-accent">Verse</span>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-5">
        {nav.map(section => (
          <div key={section.label}>
            <p className="text-[10px] font-bold text-ink-300 uppercase tracking-widest px-2 mb-1">{section.label}</p>
            {section.items.map(item => {
              const active = item.href === '/admin' ? path === '/admin' : path.startsWith(item.href)
              return (
                <Link key={item.href} href={item.href}
                  className={`admin-nav-item ${active ? 'active' : ''}`}>
                  <span className="text-sm w-4 text-center">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-ink-100">
        <a href="/" target="_blank" className="admin-nav-item text-xs">
          <span>↗</span><span>View Site</span>
        </a>
      </div>
    </aside>
  )
}
