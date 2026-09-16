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
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d={d}/>
    </svg>
  )
}

export function AdminHeader({ email, isAdmin = false, isAdvertiser = false }: { email: string; isAdmin?: boolean; isAdvertiser?: boolean }) {
  const [menu, setMenu]           = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const router = useRouter()
  const path   = usePathname()
  const { theme, toggle } = useTheme()
  const title   = TITLES[path] ?? 'Admin'
  const initial = email[0]?.toUpperCase() ?? 'A'
  const name    = email.split('@')[0]
  // Advertiser: show simple title, no breadcrumb into admin areas
  const showCrumbs = isAdmin && path !== '/admin'

  const S = { // style shorthand using CSS vars
    header:   { height:64, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 24px', flexShrink:0, background:'var(--bg-card)', borderBottom:'1px solid var(--border)' } as const,
    btn:      { display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', border:'none', transition:'all 0.12s' } as const,
    iconBtn:  { width:36, height:36, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', border:'1px solid var(--border)', background:'transparent', color:'var(--txt-2)', transition:'all 0.12s' } as const,
  }

  async function logout() { await createClient().auth.signOut(); router.push('/login') }
  async function sendReset() {
    await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/admin/reset-password` })
    setResetSent(true)
  }

  return (
    <header style={S.header}>
      {/* Left */}
      {showCrumbs ? (
        <nav style={{ display:'flex', alignItems:'center', gap:6, fontSize:14 }}>
          {path.split('/').filter(Boolean).map((seg, i, arr) => {
            const href = '/' + arr.slice(0, i + 1).join('/')
            const label = TITLES[href] ?? seg.replace(/-/g, ' ')
            const isLast = i === arr.length - 1
            return (
              <span key={href} style={{ display:'flex', alignItems:'center', gap:6 }}>
                {i > 0 && <span style={{ color:'var(--txt-3)', fontSize:12 }}>/</span>}
                {isLast
                  ? <span style={{ fontWeight:700, color:'var(--txt)' }}>{label}</span>
                  : <Link href={href} style={{ color:'var(--txt-3)', textDecoration:'none', fontWeight:500 }}>{label}</Link>}
              </span>
            )
          })}
        </nav>
      ) : (
        <h1 style={{ fontSize:15, fontWeight:700, color:'var(--txt)', margin:0 }}>{title}</h1>
      )}

      {/* Right */}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        {isAdmin && (
          <Link href="/admin/articles/new"
            style={{ ...S.btn, background:'var(--accent)', color:'#fff' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
            <Icon d="M12 4v16m8-8H4" size={13} /> New Article
          </Link>
        )}

        <button onClick={toggle} style={S.iconBtn} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--txt)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--txt-2)' }}>
          {theme === 'dark'
            ? <Icon d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            : <Icon d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />}
        </button>

        {/* User menu */}
        <div style={{ position:'relative' }}>
          <button onClick={() => setMenu(!menu)}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:10, background:'transparent', border:'none', cursor:'pointer', transition:'background 0.1s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ width:32, height:32, borderRadius:10, background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:12, fontWeight:900 }}>
              {initial}
            </div>
            <div style={{ textAlign:'left' }} className="hidden sm:block">
              <p style={{ fontSize:13, fontWeight:600, color:'var(--txt)', lineHeight:1.2 }}>{name}</p>
              <p style={{ fontSize:10, color:'var(--txt-3)', lineHeight:1.2 }}>Admin</p>
            </div>
            <span style={{ color:'var(--txt-3)', fontSize:10 }}>▾</span>
          </button>

          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div style={{ position:'absolute', right:0, top:50, width:240, borderRadius:14, border:'1px solid var(--border)', background:'var(--bg-card)', boxShadow:'0 8px 32px rgba(0,0,0,0.2)', zIndex:20, overflow:'hidden' }}>
                <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border-dim)', background:'var(--bg-subtle)' }}>
                  <p style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.12em', color:'var(--txt-3)', marginBottom:2 }}>Account</p>
                  <p style={{ fontSize:13, fontWeight:600, color:'var(--txt)' }}>{email}</p>
                </div>
                <div style={{ padding:6 }}>
                  {!showReset ? (
                    <button onClick={() => setShowReset(true)}
                      style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, fontSize:13, color:'var(--txt-2)', background:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--txt)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--txt-2)' }}>
                      <Icon d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" size={14} />
                      Reset password
                    </button>
                  ) : resetSent ? (
                    <p style={{ padding:'9px 12px', fontSize:12, color:'#22c55e', fontWeight:600 }}>✓ Reset email sent</p>
                  ) : (
                    <div style={{ padding:'8px 12px' }}>
                      <p style={{ fontSize:12, color:'var(--txt-2)', marginBottom:8 }}>Send reset to <strong style={{ color:'var(--txt)' }}>{email}</strong>?</p>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={sendReset} style={{ padding:'5px 12px', borderRadius:8, background:'var(--accent)', color:'#fff', border:'none', fontSize:12, fontWeight:600, cursor:'pointer' }}>Send</button>
                        <button onClick={() => setShowReset(false)} style={{ padding:'5px 12px', borderRadius:8, background:'var(--bg-subtle)', color:'var(--txt-2)', border:'1px solid var(--border)', fontSize:12, cursor:'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  )}
                  <div style={{ borderTop:'1px solid var(--border-dim)', marginTop:4, paddingTop:4 }}>
                    <button onClick={logout}
                      style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, fontSize:13, color:'#ef4444', background:'transparent', border:'none', cursor:'pointer', textAlign:'left' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
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
