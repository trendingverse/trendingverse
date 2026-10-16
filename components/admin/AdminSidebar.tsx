'use client'
// components/admin/AdminSidebar.tsx — v3
// v3: Analytics added to the publisher menu (Pro-only content, upsell for others).
// v2: publishers get their own menu (content tools, AI & SEO, My Earnings) —
//     admin-only sections are no longer shown to them.
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
    { label: 'Dashboard',       href: '/admin',                          d: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z' },
  ]},
  { group: 'Content', items: [
    { label: 'Articles',        href: '/admin/articles',                 d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { label: 'Categories',      href: '/admin/categories',               d: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z' },
    { label: 'Media',           href: '/admin/media',                    d: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { label: 'Paste & Enrich',  href: '/admin/paste-enrich',             d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { label: 'Video',           href: '/admin/video',                    d: 'M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  ]},
  { group: 'AI & SEO', items: [
    { label: 'AI Writer',       href: '/admin/ai-writer',                d: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { label: 'SEO Engine',      href: '/admin/seo',                      d: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
    { label: 'Trends',          href: '/admin/trends',                   d: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
    { label: 'Authors',         href: '/admin/author-fix',               d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  ]},
  { group: 'Revenue', items: [
    { label: 'Monetization',    href: '/admin/monetization',             d: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Site Scripts',    href: '/admin/monetization/site-scripts',d: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
    { label: 'Earnings',        href: '/admin/revenue',                  d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { label: 'Delivery & Fill', href: '/admin/reports',                  d: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  ]},
  { group: 'Growth', items: [
    { label: 'Outreach',        href: '/admin/outreach',                 d: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ]},
  { group: 'System', items: [
    { label: 'Analytics',       href: '/admin/analytics',                d: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' },
    { label: 'Settings',        href: '/admin/settings',                 d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ]},
]
const ADMIN_G = { group: 'Admin', items: [{ label: 'Publishers', href: '/admin/publishers', d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' }]}
const ADV_NAV = [{ group: 'Outreach', items: [{ label: 'Publisher Outreach', href: '/admin/outreach', d: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }]}]

// Publisher menu: only their own content tools + their earnings
const PUB_ALLOWED = [
  '/admin', '/admin/articles', '/admin/categories', '/admin/media', '/admin/paste-enrich', '/admin/video',
  '/admin/ai-writer', '/admin/seo', '/admin/revenue', '/admin/analytics', '/admin/settings',
]
const PUB_NAV = NAV
  .map(g => ({
    group: g.group,
    items: g.items
      .filter(i => PUB_ALLOWED.includes(i.href))
      .map(i => (i.href === '/admin/revenue' ? { ...i, label: 'My Earnings' } : i)),
  }))
  .filter(g => g.items.length > 0)

export function AdminSidebar({ isAdmin = false, isAdvertiser = false }: { isAdmin?: boolean; isAdvertiser?: boolean }) {
  const path = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const nav = isAdvertiser ? ADV_NAV : isAdmin ? [...NAV, ADMIN_G] : PUB_NAV
  useEffect(() => { setMobileOpen(false) }, [path])
  const on = (href: string) => href === '/admin' ? path === '/admin' : path.startsWith(href)

  const Inner = () => (
    <div className="flex flex-col h-full" style={{ background: 'linear-gradient(180deg, #071020 0%, #0b1628 60%, #0e1e35 100%)' }}>
      {/* Logo */}
      <div style={{ height:64, display:'flex', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.08)', padding: collapsed ? '0 8px' : '0 20px', justifyContent: collapsed ? 'center' : 'space-between', flexShrink:0, gap:8 }}>
        {collapsed ? (
          /* When collapsed: click the logo to expand */
          <button onClick={() => setCollapsed(false)}
            style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#e63946,#c1121f)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 0 12px rgba(230,57,70,0.4)', border:'none', cursor:'pointer' }}
            title="Expand sidebar">
            <span style={{ color:'#fff', fontSize:11, fontWeight:900 }}>TV</span>
          </button>
        ) : (
          <Link href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#e63946,#c1121f)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 0 12px rgba(230,57,70,0.4)' }}>
              <span style={{ color:'#fff', fontSize:11, fontWeight:900 }}>TV</span>
            </div>
            <div>
              <span style={{ fontWeight:800, fontSize:14, color:'#e8f4ff', letterSpacing:'-0.3px', display:'block' }}>TrendingVerse</span>
              <span style={{ fontSize:9, fontWeight:600, color:'rgba(56,189,248,0.6)', letterSpacing:'0.15em', textTransform:'uppercase' }}>CMS Studio</span>
            </div>
          </Link>
        )}
        {/* Collapse button — only show when expanded (collapsed state uses the TV logo button instead) */}
        {!collapsed && (
          <button onClick={() => setCollapsed(true)}
            className="hidden lg:flex" style={{ width:28, height:28, borderRadius:8, alignItems:'center', justifyContent:'center', color:'rgba(126,168,201,0.7)', cursor:'pointer', border:'1px solid rgba(56,189,248,0.12)', background:'rgba(56,189,248,0.04)', flexShrink:0 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,189,248,0.10)'; e.currentTarget.style.color = '#e8f4ff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(56,189,248,0.04)'; e.currentTarget.style.color = 'rgba(126,168,201,0.7)' }}>
            <Icon d="M15 19l-7-7 7-7" size={14} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex:1, overflowY:'auto', padding:'16px 10px', scrollbarWidth:'none' }}>
        {nav.map(s => (
          <div key={s.group} style={{ marginBottom:24 }}>
            {!collapsed && (
              <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.14em', color:'rgba(255,255,255,0.22)', padding:'0 10px', marginBottom:6 }}>
                {s.group}
              </p>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
              {s.items.map(item => {
                const active = on(item.href)
                return (
                  <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}
                    style={{
                      display:'flex', alignItems:'center', gap:10, padding: collapsed ? '10px' : '8px 12px',
                      borderRadius:10, fontSize:13, fontWeight: active ? 600 : 400,
                      color: active ? '#ff8a8a' : 'rgba(148,184,212,0.9)',
                      background: active ? 'rgba(230,57,70,0.12)' : 'transparent',
                      textDecoration:'none', transition:'all 0.12s',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      borderLeft: active && !collapsed ? '2px solid #e63946' : '2px solid transparent',
                      paddingLeft: active && !collapsed ? '10px' : collapsed ? '10px' : '12px',
                      boxShadow: active ? 'inset 0 0 20px rgba(230,57,70,0.05)' : 'none',
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#f0f8ff' } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(148,184,212,0.9)' } }}>
                    <span style={{ flexShrink:0, color: active ? '#ff8a8a' : 'rgba(148,184,212,0.55)', display:'flex' }}>
                      <Icon d={item.d} size={15} />
                    </span>
                    {!collapsed && <span style={{ flex:1 }}>{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* View Site */}
      <div style={{ padding:'10px', borderTop:'1px solid rgba(56,189,248,0.08)', flexShrink:0 }}>
        <a href="/" target="_blank" rel="noopener noreferrer"
          style={{ display:'flex', alignItems:'center', gap:10, padding: collapsed ? '9px' : '9px 12px', borderRadius:10, fontSize:12, fontWeight:500, color:'rgba(148,184,212,0.45)', textDecoration:'none', justifyContent: collapsed ? 'center' : 'flex-start' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--nav-hover)'; e.currentTarget.style.color = 'var(--txt)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--txt-3)' }}>
          <Icon d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" size={14} />
          {!collapsed && <span>View Site</span>}
        </a>
      </div>
    </div>
  )

  return (
    <>
      <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden"
        style={{ position:'fixed', top:14, left:14, zIndex:50, width:36, height:36, borderRadius:10, background:'var(--bg-card)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--txt)', cursor:'pointer' }}>
        <Icon d={mobileOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} size={16} />
      </button>
      {mobileOpen && <div className="lg:hidden fixed inset-0 z-40" style={{ background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)' }} onClick={() => setMobileOpen(false)} />}
      <aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 shadow-2xl" style={{ transform: mobileOpen ? 'none' : 'translateX(-100%)', transition:'transform 0.2s', borderRight:'1px solid rgba(56,189,248,0.10)' }}>
        <Inner />
      </aside>
      <aside className="hidden lg:flex flex-col flex-shrink-0" style={{ width: collapsed ? 58 : 228, transition:'width 0.2s', borderRight:'1px solid rgba(56,189,248,0.10)' }}>
        <Inner />
      </aside>
    </>
  )
}
