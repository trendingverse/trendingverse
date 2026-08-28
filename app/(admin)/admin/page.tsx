// app/(admin)/admin/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// Safe query — never throws
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safe<T = any>(fn: () => any, fallback: T): Promise<T> {
  try {
    const result = await fn()
    if (result?.error) return fallback
    return result?.data ?? result?.count ?? fallback
  } catch {
    return fallback
  }
}

async function safeCount(fn: () => any): Promise<number> {
  try {
    const result = await fn()
    if (result?.error) return 0
    return typeof result?.count === 'number' ? result.count : 0
  } catch {
    return 0
  }
}

export default async function AdminDashboard() {
  const supabase = await createClient()
  const now = new Date()

  const d30 = new Date(now)
  d30.setDate(now.getDate() - 30)

  const [totalArticles, draftCount, publishedToday, recentArticles] = await Promise.all([
    safeCount(() => supabase.from('articles').select('*', { count: 'exact', head: true })),
    safeCount(() => supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'draft')),
    safeCount(() => supabase.from('articles').select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('published_at', now.toISOString().slice(0, 10) + 'T00:00:00Z')),
    safe(() => supabase.from('articles').select('id,title,status,published_at,category_name')
      .order('created_at', { ascending: false }).limit(10), []),
  ])

  // Revenue data — safe, won't crash if table/columns differ
  const revData = await safe(async () => {
    const r = await supabase.from('partner_revenue')
      .select('revenue_usd, impressions, revenue_date')
      .gte('revenue_date', d30.toISOString().slice(0, 10))
    return r
  }, [])

  const rows = Array.isArray(revData) ? revData : []
  const monthRev  = rows.reduce((s: number, r: any) => s + (r.revenue_usd ?? 0), 0)
  const monthImpr = rows.reduce((s: number, r: any) => s + (r.impressions ?? 0), 0)

  const fmtMoney = (n: number) => n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`
  const fmtK     = (n: number) => n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1_000 ? `${(n / 1e3).toFixed(1)}k` : String(n)

  const S = { background: '#0e1726', border: '1px solid #1a2840' }
  const T = { color: '#dde4f0' }

  return (
    <div style={{ color: '#dde4f0', paddingBottom: 32 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live</span>
        </div>
        <p style={{ fontSize: 13, color: '#6b82a8' }}>
          {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Articles', value: String(totalArticles), color: '#f59e0b' },
          { label: 'Drafts', value: String(draftCount), color: '#94a3b8' },
          { label: 'Published Today', value: String(publishedToday), color: '#10b981' },
          { label: 'Revenue (30d)', value: fmtMoney(monthRev), color: '#38bdf8' },
        ].map(k => (
          <div key={k.label} style={{ ...S, borderRadius: 12, padding: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2d3f58', marginBottom: 8 }}>{k.label}</p>
            <p style={{ fontSize: 28, fontFamily: 'monospace', fontWeight: 700, color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Impressions stat */}
      {monthImpr > 0 && (
        <div style={{ ...S, borderRadius: 12, padding: '12px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 11, color: '#2d3f58', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Impressions (30d)</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#a78bfa' }}>{fmtK(monthImpr)}</span>
        </div>
      )}

      {/* Recent Articles */}
      <div style={{ ...S, borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #111e30' }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#2d3f58', margin: 0 }}>Recent Articles</h2>
          <Link href="/admin/articles" style={{ fontSize: 12, color: '#dc2626' }}>All →</Link>
        </div>
        {(recentArticles as any[]).length === 0 ? (
          <p style={{ textAlign: 'center', padding: 32, color: '#2d3f58', fontSize: 13 }}>
            No articles yet. <Link href="/admin/articles/new" style={{ color: '#dc2626' }}>Create one →</Link>
          </p>
        ) : (
          (recentArticles as any[]).map((a: any) => {
            const statusColor: Record<string, string> = {
              published: '#10b981', draft: '#64748b', scheduled: '#f59e0b'
            }
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #111e30' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/admin/articles/${a.id}/edit`} style={{ fontSize: 13, fontWeight: 500, color: '#dde4f0', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.title}
                  </Link>
                  {a.published_at && <span style={{ fontSize: 11, color: '#2d3f58' }}>{a.published_at.slice(0, 10)}</span>}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: statusColor[a.status] ?? '#64748b', flexShrink: 0 }}>
                  {a.status}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Quick Actions */}
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#2d3f58', marginBottom: 12 }}>Quick Actions</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          { href: '/admin/articles/new', icon: '✏️', label: 'New Article' },
          { href: '/admin/ai-writer',    icon: '🤖', label: 'AI Writer' },
          { href: '/admin/trends',       icon: '🔥', label: 'Trends' },
          { href: '/admin/seo',          icon: '🎯', label: 'SEO Engine' },
          { href: '/admin/revenue',      icon: '💰', label: 'Earnings' },
          { href: '/admin/outreach',     icon: '📋', label: 'Outreach' },
        ].map(a => (
          <Link key={a.href} href={a.href} style={{ ...S, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <span style={{ fontSize: 18 }}>{a.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#6b82a8' }}>{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
