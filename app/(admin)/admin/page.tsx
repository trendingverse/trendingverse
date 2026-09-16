// app/(admin)/admin/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function safeCount(fn: () => any): Promise<number> {
  try { const r = await fn(); return r?.error ? 0 : (r?.count ?? 0) } catch { return 0 }
}
async function safeData(fn: () => any): Promise<any[]> {
  try { const r = await fn(); return r?.data ?? [] } catch { return [] }
}

export default async function AdminDashboard() {
  let user: any = null
  let total = 0, published = 0, drafts = 0, todayPub = 0
  let articles: any[] = []

  try {
    const supabase = await createClient()
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) redirect('/login')
    user = u

    const now = new Date()
    const todayISO = now.toISOString().slice(0, 10)

    ;[total, published, drafts, todayPub, articles] = await Promise.all([
      safeCount(() => supabase.from('articles').select('*', { count: 'exact', head: true })),
      safeCount(() => supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'published')),
      safeCount(() => supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'draft')),
      safeCount(() => supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'published').gte('published_at', todayISO + 'T00:00:00Z')),
      safeData(() => supabase.from('articles').select('id,title,status,published_at,category_name').order('created_at', { ascending: false }).limit(8)),
    ])
  } catch (e) {
    console.error('[AdminDashboard] error:', e)
  }

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.email?.split('@')[0] ?? 'there'

  const kpis = [
    { icon: '📄', label: 'TOTAL ARTICLES',  value: total,     bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
    { icon: '✅', label: 'PUBLISHED',        value: published, bg: 'rgba(16,185,129,0.12)', color: '#34d399' },
    { icon: '✏️', label: 'DRAFTS',           value: drafts,    bg: 'rgba(245,158,11,0.12)', color: '#fbbf24' },
    { icon: '🚀', label: 'TODAY',            value: todayPub,  bg: 'rgba(239,68,68,0.12)',  color: '#f87171' },
  ]

  const statusStyle: Record<string, { bg: string; color: string }> = {
    published: { bg: 'rgba(16,185,129,0.12)', color: '#34d399' },
    draft:     { bg: 'var(--bg-subtle)',       color: 'var(--txt-3)' },
    scheduled: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24' },
  }

  const actions = [
    { href: '/admin/articles/new',               icon: '✏️', label: 'New Article',    accent: true },
    { href: '/admin/ai-writer',                  icon: '⚡', label: 'AI Writer'            },
    { href: '/admin/trends',                     icon: '🔥', label: 'Trending Topics'      },
    { href: '/admin/seo',                        icon: '🎯', label: 'SEO Engine'           },
    { href: '/admin/revenue',                    icon: '💰', label: 'Earnings'             },
    { href: '/admin/monetization/site-scripts',  icon: '🔧', label: 'Site Scripts'         },
    { href: '/admin/outreach',                   icon: '📋', label: 'Outreach'             },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 32, color: 'var(--txt)' }}>

      {/* Welcome */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--txt-3)', marginBottom: 6 }}>
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--txt)', margin: 0, letterSpacing: '-0.5px' }}>
            {greeting}, {firstName} 👋
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/admin/trends"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--bg-subtle)', color: 'var(--txt-2)', border: '1px solid var(--border)', textDecoration: 'none' }}>
            🔥 Trends
          </Link>
          <Link href="/admin/articles/new"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--accent)', color: '#fff', textDecoration: 'none' }}>
            + New Article
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              {k.icon}
            </div>
            <div>
              <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--txt)', lineHeight: 1, margin: 0 }}>{k.value}</p>
              <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--txt-3)', marginTop: 4 }}>{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>

        {/* Recent articles */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)', margin: 0 }}>Recent Articles</p>
              <p style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 2 }}>Latest content across all publishers</p>
            </div>
            <Link href="/admin/articles" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>View all →</Link>
          </div>
          {articles.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--txt-3)', fontSize: 13 }}>
              No articles yet. <Link href="/admin/articles/new" style={{ color: 'var(--accent)' }}>Write one →</Link>
            </div>
          ) : articles.map((a: any) => {
            const st = statusStyle[a.status] ?? statusStyle.draft
            return (
              <Link key={a.id} href={`/admin/articles/${a.id}/edit`}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border-dim)', textDecoration: 'none', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{a.title}</p>
                  <p style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 2 }}>
                    {a.category_name || 'Uncategorized'}
                    {a.published_at && ` · ${new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  </p>
                </div>
                <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 10px', borderRadius: 20, background: st.bg, color: st.color }}>
                  {a.status}
                </span>
              </Link>
            )
          })}
        </div>

        {/* Quick actions */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)', margin: 0 }}>Quick Actions</p>
            <p style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 2 }}>Jump to common tasks</p>
          </div>
          <div style={{ padding: 8 }}>
            {actions.map(a => (
              <Link key={a.href} href={a.href}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none', transition: 'all 0.1s', marginBottom: 2, background: a.accent ? 'var(--accent)' : 'transparent', color: a.accent ? '#fff' : 'var(--txt-2)' }}
                onMouseEnter={e => { if (!a.accent) { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--txt)' } }}
                onMouseLeave={e => { if (!a.accent) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--txt-2)' } }}>
                <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{a.icon}</span>
                <span style={{ flex: 1 }}>{a.label}</span>
                <span style={{ fontSize: 11, opacity: 0.4 }}>→</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
