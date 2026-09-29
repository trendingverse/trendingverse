// app/(admin)/admin/page.tsx — v5
// Publishers see ONLY their own articles (written by them or on their sites),
// their own quick actions, and their earnings (last 30 days, their share) —
// earnings only for packages that include ads; free plan sees an upgrade link.
// Admin sees everything. Hover effects in CSS; redirect outside try/catch.
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
const PLANS_WITH_ADS = ['growth', 'pro', 'byoak', 'agency']

async function safeCount(fn: () => any): Promise<number> {
  try { const r = await fn(); return r?.error ? 0 : (r?.count ?? 0) } catch { return 0 }
}
async function safeData(fn: () => any): Promise<any[]> {
  try { const r = await fn(); return r?.data ?? [] } catch { return [] }
}


const hostOf = (s: any) =>
  String(s || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase()

// Publisher earnings for the last 30 days (their share, INR). No partner names involved.
async function publisherEarnings30d(userId: string): Promise<number> {
  try {
    const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const [{ data: owned }, { data: asg }, { data: fx }] = await Promise.all([
      admin.from('sites').select('id,site_url').eq('user_id', userId),
      admin.from('publisher_ads').select('site_id,revenue_share_pct').eq('publisher_id', userId),
      admin.from('currency_rates').select('base_currency,target_currency,rate')
        .or('and(base_currency.eq.USD,target_currency.eq.INR),and(base_currency.eq.INR,target_currency.eq.USD)')
        .order('rate_date', { ascending: false }).limit(1),
    ])
    const ids = new Set<string>([...(owned || []).map((s: any) => s.id), ...(asg || []).map((a: any) => a.site_id).filter(Boolean)])
    if (!ids.size) return 0
    const { data: sites } = await admin.from('sites').select('id,site_url').in('id', Array.from(ids))
    const share: Record<string, number> = {}
    for (const s of sites || []) {
      const p = (asg || []).filter((a: any) => a.site_id === s.id).map((a: any) => Number(a.revenue_share_pct) || 0).filter(Boolean)
      share[hostOf(s.site_url)] = p.length ? Math.max(...p) : 70
    }
    const hosts = Object.keys(share).filter(Boolean)
    const x = fx?.[0]
    let rate = x && Number(x.rate) ? (x.base_currency === 'USD' ? Number(x.rate) : 1 / Number(x.rate)) : 83.5
    if (!(rate > 10 && rate < 1000)) rate = 83.5
    const since = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10)
    let total = 0
    for (let from = 0; from < 50000; from += 1000) {
      const { data } = await admin.from('partner_revenue').select('site_url,revenue_usd').gte('revenue_date', since).range(from, from + 999)
      for (const r of data || []) {
        const h = hostOf(r.site_url)
        const m = hosts.find(x => h === x || h.endsWith('.' + x) || x.endsWith('.' + h))
        if (m) total += (Number(r.revenue_usd) || 0) * share[m] / 100
      }
      if (!data || data.length < 1000) break
    }
    return Math.round(total * rate * 100) / 100
  } catch { return 0 }
}

const hoverCss = `
.tv-row { background: transparent; transition: background 0.1s; }
.tv-row:hover { background: var(--bg-subtle); }
.tv-qa { background: transparent; color: var(--txt-2); transition: all 0.1s; }
.tv-qa:hover { background: var(--bg-subtle); color: var(--txt); }
`

export default async function AdminDashboard() {
  let user: any = null
  let noUser = false
  let isAdmin = false
  let total = 0, published = 0, drafts = 0, todayPub = 0
  let articles: any[] = []
  let earnings30 = 0
  let adsPlan = true

  try {
    const supabase = await createClient()
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) {
      noUser = true
    } else {
      user = u
      isAdmin = u.email === ADMIN_EMAIL

      // Scope for publishers: their own articles, or articles on sites they own
      let scope: (q: any) => any = q => q
      if (!isAdmin) {
        const { data: mySites } = await supabase.from('sites').select('id').eq('user_id', u.id)
        const siteIds = (mySites || []).map((s: any) => s.id)
        scope = siteIds.length
          ? (q: any) => q.or(`user_id.eq.${u.id},site_id.in.(${siteIds.join(',')})`)
          : (q: any) => q.eq('user_id', u.id)
      }

      const todayISO = new Date().toISOString().slice(0, 10)
      const base = () => supabase.from('articles').select('*', { count: 'exact', head: true })

      ;[total, published, drafts, todayPub, articles] = await Promise.all([
        safeCount(() => scope(base())),
        safeCount(() => scope(base().eq('status', 'published'))),
        safeCount(() => scope(base().eq('status', 'draft'))),
        safeCount(() => scope(base().eq('status', 'published').gte('published_at', todayISO + 'T00:00:00Z'))),
        safeData(() => scope(supabase.from('articles').select('id,title,status,published_at,category_name')).order('created_at', { ascending: false }).limit(8)),
      ])
      if (!isAdmin) {
        const { data: prof } = await supabase.from('user_profiles').select('plan').eq('id', u.id).maybeSingle()
        adsPlan = PLANS_WITH_ADS.includes(String(prof?.plan || 'free').toLowerCase())
        if (adsPlan) earnings30 = await publisherEarnings30d(u.id)
      }
    }
  } catch (e) {
    console.error('[AdminDashboard] error:', e)
  }

  // redirect() must be called outside try/catch, otherwise the catch swallows it
  if (noUser) redirect('/login')

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.email?.split('@')[0] ?? 'there'

  const kpis: { icon: string; label: string; value: any; bg: string; href?: string }[] = [
    { icon: '📄', label: 'TOTAL ARTICLES',  value: total,     bg: 'rgba(59,130,246,0.12)' },
    { icon: '✅', label: 'PUBLISHED',        value: published, bg: 'rgba(16,185,129,0.12)' },
    { icon: '✏️', label: 'DRAFTS',           value: drafts,    bg: 'rgba(245,158,11,0.12)' },
    isAdmin
      ? { icon: '🚀', label: 'TODAY', value: todayPub, bg: 'rgba(239,68,68,0.12)' }
      : adsPlan
        ? { icon: '💰', label: 'EARNINGS · 30 DAYS', value: '₹' + earnings30.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), bg: 'rgba(16,185,129,0.12)', href: '/admin/revenue' }
        : { icon: '💰', label: 'UPGRADE TO EARN FROM ADS', value: 'Upgrade', bg: 'rgba(245,158,11,0.12)', href: '/pricing' },
  ]

  const statusStyle: Record<string, { bg: string; color: string }> = {
    published: { bg: 'rgba(16,185,129,0.12)', color: '#34d399' },
    draft:     { bg: 'var(--bg-subtle)',       color: 'var(--txt-3)' },
    scheduled: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24' },
  }

  // Publishers get only their own tools
  const actions = isAdmin ? [
    { href: '/admin/articles/new',               icon: '✏️', label: 'New Article',    accent: true },
    { href: '/admin/ai-writer',                  icon: '⚡', label: 'AI Writer'            },
    { href: '/admin/trends',                     icon: '🔥', label: 'Trending Topics'      },
    { href: '/admin/seo',                        icon: '🎯', label: 'SEO Engine'           },
    { href: '/admin/revenue',                    icon: '💰', label: 'Earnings'             },
    { href: '/admin/monetization/site-scripts',  icon: '🔧', label: 'Site Scripts'         },
    { href: '/admin/outreach',                   icon: '📋', label: 'Outreach'             },
  ] : [
    { href: '/admin/articles/new',               icon: '✏️', label: 'New Article',    accent: true },
    { href: '/admin/articles',                   icon: '📄', label: 'My Articles'          },
    { href: '/admin/ai-writer',                  icon: '⚡', label: 'AI Writer'            },
    { href: '/admin/seo',                        icon: '🎯', label: 'SEO Engine'           },
    { href: '/admin/revenue',                    icon: '💰', label: 'My Earnings'          },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 32, color: 'var(--txt)' }}>
      <style dangerouslySetInnerHTML={{ __html: hoverCss }} />

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
          {isAdmin && (
            <Link href="/admin/trends"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--bg-subtle)', color: 'var(--txt-2)', border: '1px solid var(--border)', textDecoration: 'none' }}>
              🔥 Trends
            </Link>
          )}
          <Link href="/admin/articles/new"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--accent)', color: '#fff', textDecoration: 'none' }}>
            + New Article
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {kpis.map(k => {
          const card = (
          <div key={k.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, display: 'flex', alignItems: 'center', gap: 14, height: '100%', boxSizing: 'border-box' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              {k.icon}
            </div>
            <div>
              <p style={{ fontSize: 28, fontWeight: 900, color: 'var(--txt)', lineHeight: 1, margin: 0 }}>{k.value}</p>
              <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--txt-3)', marginTop: 4 }}>{k.label}</p>
            </div>
          </div>
          )
          return k.href ? <Link key={k.label} href={k.href} style={{ textDecoration: 'none' }}>{card}</Link> : card
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)', margin: 0 }}>Recent Articles</p>
              <p style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 2 }}>{isAdmin ? 'Latest content across all publishers' : 'Your latest content'}</p>
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
              <Link key={a.id} href={`/admin/articles/${a.id}/edit`} className="tv-row"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border-dim)', textDecoration: 'none' }}>
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

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)', margin: 0 }}>Quick Actions</p>
            <p style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 2 }}>Jump to common tasks</p>
          </div>
          <div style={{ padding: 8 }}>
            {actions.map(a => (
              <Link key={a.href} href={a.href} className={a.accent ? undefined : 'tv-qa'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 2,
                  ...(a.accent ? { background: 'var(--accent)', color: '#fff' } : {}),
                }}>
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
