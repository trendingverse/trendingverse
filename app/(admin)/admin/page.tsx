// app/(admin)/admin/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { RevenueAreaChart, ImpressionsBarChart, NetworkBarChart } from './_components/DashboardCharts'

export const dynamic    = 'force-dynamic'
export const revalidate = 0

/* ─── Formatters ─────────────────────────────────────────────────── */
const fmtMoney = (n: number) => n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`
const fmtK     = (n: number) => n >= 1_000_000 ? `${(n/1e6).toFixed(1)}M` : n >= 1_000 ? `${(n/1e3).toFixed(1)}k` : String(n)
const fmtDate  = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })

/* ─── Design tokens ──────────────────────────────────────────────── */
const C = {
  bg:       '#07101f',
  surface:  '#0e1726',
  elevated: '#131f33',
  border:   '#1a2840',
  borderDim:'#111e30',
  text:     '#dde4f0',
  muted:    '#6b82a8',
  dim:      '#2d3f58',
}

/* ─── Small server components ────────────────────────────────────── */
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl ${className}`} style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      {children}
    </div>
  )
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <Card>
      <div className="p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: C.dim }}>
          {label}
        </p>
        <p className={`text-[28px] font-mono font-bold leading-none ${accent}`}>{value}</p>
        {sub && <p className="text-[12px] mt-1.5" style={{ color: C.muted }}>{sub}</p>}
      </div>
    </Card>
  )
}

function SectionHead({ title, action }: { title: string; action?: { label: string; href: string } }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: C.dim }}>{title}</h2>
      {action && (
        <Link href={action.href} className="text-[12px] font-medium transition-colors" style={{ color: '#e63030' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={e => (e.currentTarget.style.color = '#e63030')}>
          {action.label} →
        </Link>
      )}
    </div>
  )
}

function StatusDot({ on }: { on: boolean }) {
  return <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${on ? 'bg-emerald-500' : 'bg-slate-700'}`} />
}

type ArticleRow = { id: string; title: string; status: string; category_name?: string; published_at?: string; seo_score?: number }

function ArticleItem({ a }: { a: ArticleRow }) {
  const scoreColor = (a.seo_score ?? 0) >= 70 ? 'text-emerald-400' : (a.seo_score ?? 0) >= 40 ? 'text-amber-400' : 'text-red-400'
  const statusColor: Record<string,string> = {
    published: 'bg-emerald-500/10 text-emerald-400',
    draft:     'bg-slate-800 text-slate-500',
    scheduled: 'bg-amber-500/10 text-amber-400',
    archived:  'bg-slate-900 text-slate-700',
  }
  return (
    <div
      className="flex items-center gap-3 px-5 py-3 transition-colors group"
      style={{ borderBottom: `1px solid ${C.borderDim}` }}
      onMouseEnter={e => (e.currentTarget.style.background = C.elevated)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div className="flex-1 min-w-0">
        <Link
          href={`/admin/articles/${a.id}/edit`}
          className="text-[13px] font-medium truncate block transition-colors"
          style={{ color: C.text }}
        >
          {a.title}
        </Link>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px]" style={{ color: C.dim }}>{a.category_name || 'Uncategorized'}</span>
          {a.published_at && (
            <>
              <span style={{ color: C.borderDim }}>·</span>
              <span className="text-[11px]" style={{ color: C.dim }}>{fmtDate(a.published_at)}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {a.seo_score != null && (
          <span className={`text-[11px] font-mono font-semibold ${scoreColor}`}>{a.seo_score}</span>
        )}
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor[a.status] ?? statusColor.draft}`}>
          {a.status}
        </span>
        <Link
          href={`/admin/articles/${a.id}/edit`}
          className="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: C.muted }}
        >
          Edit
        </Link>
      </div>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────── */
export default async function AdminDashboard() {
  const supabase   = await createClient()
  const now        = new Date()
  const todayISO   = now.toISOString().slice(0, 10)

  const d14 = new Date(now); d14.setDate(now.getDate() - 14)
  const d30 = new Date(now); d30.setDate(now.getDate() - 30)
  const d7  = new Date(now); d7.setDate(now.getDate() - 7)

  /* ── Parallel queries ─────────────────────────────────────────── */
  const [
    { count: totalArticles },
    { count: draftCount },
    { count: pubToday },
    { data: revRows },
    { data: articles },
    { data: topArticles },
    { data: adNetworks },
    { data: sites },
    { data: recentRev },
  ] = await Promise.all([
    supabase.from('articles').select('*', { count: 'exact', head: true }),
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status','draft'),
    supabase.from('articles').select('*', { count: 'exact', head: true })
      .eq('status','published').gte('published_at', todayISO + 'T00:00:00Z'),
    supabase.from('partner_revenue')
      .select('date,revenue_usd,impressions,network_name')
      .gte('date', d30.toISOString().slice(0,10))
      .order('date', { ascending: true }),
    supabase.from('articles')
      .select('id,title,status,published_at,category_name,seo_score')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('articles')
      .select('id,title,view_count,category_name')
      .eq('status','published')
      .order('view_count', { ascending: false })
      .limit(5),
    supabase.from('ad_networks')
      .select('id,name,is_active,priority')
      .order('priority', { ascending: true }),
    supabase.from('sites')
      .select('id,name,site_url,is_active')
      .limit(6),
    supabase.from('partner_revenue')
      .select('date,network_name,revenue_usd,impressions,site_url')
      .order('date', { ascending: false })
      .limit(8),
  ])

  /* ── Aggregate ────────────────────────────────────────────────── */
  const rows      = revRows ?? []
  const todayRev  = rows.filter(r => r.date === todayISO).reduce((s,r) => s + (r.revenue_usd ?? 0), 0)
  const weekRev   = rows.filter(r => r.date >= d7.toISOString().slice(0,10)).reduce((s,r) => s + (r.revenue_usd ?? 0), 0)
  const monthRev  = rows.reduce((s,r) => s + (r.revenue_usd ?? 0), 0)
  const monthImpr = rows.reduce((s,r) => s + (r.impressions ?? 0), 0)
  const todayImpr = rows.filter(r => r.date === todayISO).reduce((s,r) => s + (r.impressions ?? 0), 0)
  const cpm       = monthImpr > 0 ? (monthRev / monthImpr) * 1000 : 0

  /* ── 14-day chart data ────────────────────────────────────────── */
  const chartDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - 13 + i)
    return d.toISOString().slice(0, 10)
  })
  const chartData = chartDays.map(date => ({
    date: date.slice(5),
    revenue:     rows.filter(r => r.date === date).reduce((s,r) => s + (r.revenue_usd ?? 0), 0),
    impressions: rows.filter(r => r.date === date).reduce((s,r) => s + (r.impressions ?? 0), 0),
  }))

  /* ── Network breakdown ────────────────────────────────────────── */
  const netMap: Record<string, number> = {}
  rows.forEach(r => {
    const n = r.network_name ?? 'Unknown'
    netMap[n] = (netMap[n] ?? 0) + (r.revenue_usd ?? 0)
  })
  const netData = Object.entries(netMap)
    .map(([network, revenue]) => ({ network, revenue }))
    .sort((a, b) => b.revenue - a.revenue)

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div className="space-y-6 pb-8" style={{ color: C.text }}>

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-mono font-semibold text-emerald-500 uppercase tracking-wider">Live</span>
          </div>
          <p className="text-[13px]" style={{ color: C.muted }}>
            {now.toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/ai-writer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors"
            style={{ background: C.elevated, border: `1px solid ${C.border}`, color: C.muted }}
          >
            ✦ AI Writer
          </Link>
          <Link
            href="/admin/articles/new"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-semibold text-white"
            style={{ background: '#dc2626' }}
          >
            + New Article
          </Link>
        </div>
      </div>

      {/* ── KPI row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Revenue today"   value={fmtMoney(todayRev)}  sub={`${fmtMoney(weekRev)} this week`}                accent="text-emerald-400" />
        <Stat label="Revenue (30d)"   value={fmtMoney(monthRev)}  sub={`CPM $${cpm.toFixed(2)}`}                        accent="text-sky-400"     />
        <Stat label="Impressions (30d)" value={fmtK(monthImpr)}   sub={`${fmtK(todayImpr)} today`}                      accent="text-violet-400"  />
        <Stat label="Articles"        value={String(totalArticles ?? 0)} sub={`${draftCount ?? 0} drafts · ${pubToday ?? 0} today`} accent="text-amber-400"  />
      </div>

      {/* ── Charts row ──────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <SectionHead title="Revenue — 14 days" action={{ label: 'Full report', href: '/admin/revenue' }} />
          <RevenueAreaChart data={chartData} />
        </Card>
        <Card className="p-5">
          <SectionHead title="By Network" />
          {netData.length > 0 ? (
            <>
              <NetworkBarChart data={netData} />
              <div className="mt-4 pt-4 space-y-2" style={{ borderTop: `1px solid ${C.borderDim}` }}>
                {netData.map(n => (
                  <div key={n.network} className="flex items-center justify-between">
                    <span className="text-[12px]" style={{ color: C.muted }}>{n.network}</span>
                    <span className="text-[12px] font-mono font-semibold text-emerald-400">{fmtMoney(n.revenue)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center gap-2" style={{ color: C.dim }}>
              <span className="text-2xl">📡</span>
              <p className="text-[12px]">No network data</p>
              <Link href="/admin/monetization/ad-networks" className="text-[11px] text-red-500 hover:text-red-400">
                Connect networks →
              </Link>
            </div>
          )}
        </Card>
      </div>

      {/* ── Impressions + top articles ──────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <SectionHead title="Impressions — 14 days" />
          <ImpressionsBarChart data={chartData} />
        </Card>
        <Card className="p-5">
          <SectionHead title="Top articles by views" action={{ label: 'All articles', href: '/admin/articles' }} />
          <div className="space-y-3 mt-1">
            {(topArticles ?? []).length === 0 && (
              <p className="text-[13px] text-center py-6" style={{ color: C.dim }}>No published articles yet</p>
            )}
            {(topArticles ?? []).map((a, i) => (
              <div key={a.id} className="flex items-center gap-3">
                <span className="text-[11px] font-mono w-4 text-right flex-shrink-0" style={{ color: C.dim }}>
                  {String(i + 1).padStart(2,'0')}
                </span>
                <div className="flex-1 min-w-0">
                  <Link href={`/admin/articles/${a.id}/edit`}
                    className="text-[13px] font-medium truncate block hover:text-white transition-colors"
                    style={{ color: C.text }}
                  >
                    {a.title}
                  </Link>
                  <span className="text-[11px]" style={{ color: C.dim }}>{a.category_name || 'Uncategorized'}</span>
                </div>
                <span className="text-[12px] font-mono text-violet-400 flex-shrink-0">{fmtK(a.view_count ?? 0)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Articles + infrastructure ───────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4">

        {/* Recent articles */}
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${C.borderDim}` }}>
            <SectionHead title="Recent Articles" />
            <Link href="/admin/articles" className="text-[12px] font-medium text-red-500 hover:text-red-400 mb-4">
              All articles →
            </Link>
          </div>
          {(articles ?? []).length === 0 ? (
            <p className="text-[13px] text-center py-8" style={{ color: C.dim }}>
              No articles yet.{' '}
              <Link href="/admin/articles/new" className="text-red-500">Create one →</Link>
            </p>
          ) : (
            <div>
              {(articles as ArticleRow[]).map(a => <ArticleItem key={a.id} a={a} />)}
            </div>
          )}
        </Card>

        {/* Infrastructure */}
        <div className="space-y-4">
          {/* Ad networks */}
          <Card className="p-4">
            <SectionHead title="Ad Networks" action={{ label: 'Manage', href: '/admin/monetization/ad-networks' }} />
            <div className="space-y-2">
              {(adNetworks ?? []).length === 0 ? (
                <Link href="/admin/monetization/ad-networks" className="text-[12px] text-red-500 block text-center py-3">
                  + Connect your first network
                </Link>
              ) : (
                (adNetworks ?? []).map(n => (
                  <div key={n.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusDot on={n.is_active} />
                      <span className="text-[13px]" style={{ color: n.is_active ? C.text : C.dim }}>{n.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono" style={{ color: C.dim }}>P{n.priority}</span>
                      <span className={`text-[11px] font-semibold ${n.is_active ? 'text-emerald-500' : 'text-slate-700'}`}>
                        {n.is_active ? 'Live' : 'Off'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Sites */}
          <Card className="p-4">
            <SectionHead title="Publisher Sites" action={{ label: 'Manage', href: '/admin/monetization' }} />
            <div className="space-y-2">
              {(sites ?? []).map(s => (
                <div key={s.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot on={s.is_active} />
                    <span className="text-[13px] truncate" style={{ color: s.is_active ? C.text : C.dim }}>
                      {s.name || s.site_url}
                    </span>
                  </div>
                  <span className={`text-[11px] flex-shrink-0 ${s.is_active ? 'text-sky-500' : 'text-slate-700'}`}>
                    {s.is_active ? 'Live' : '—'}
                  </span>
                </div>
              ))}
              {(sites ?? []).length === 0 && (
                <p className="text-[12px] text-center py-3" style={{ color: C.dim }}>No sites yet</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Recent revenue activity ──────────────────────────────── */}
      {(recentRev ?? []).length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3.5" style={{ borderBottom: `1px solid ${C.borderDim}` }}>
            <SectionHead title="Recent Revenue Activity" action={{ label: 'View all', href: '/admin/revenue' }} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.borderDim}` }}>
                  {['Date','Network','Site','Impressions','Revenue'].map((h, i) => (
                    <th key={h} className={`py-2.5 px-5 text-[10px] font-semibold uppercase tracking-widest font-mono ${i >= 3 ? 'text-right' : 'text-left'}`}
                      style={{ color: C.dim }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(recentRev ?? []).map((r, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: `1px solid ${C.borderDim}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.elevated)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="py-2.5 px-5 font-mono text-[12px]" style={{ color: C.dim }}>{r.date}</td>
                    <td className="py-2.5 px-5" style={{ color: C.text }}>{r.network_name}</td>
                    <td className="py-2.5 px-5 text-[12px] max-w-[180px] truncate" style={{ color: C.muted }}>{r.site_url}</td>
                    <td className="py-2.5 px-5 text-right font-mono text-[12px]" style={{ color: C.muted }}>{fmtK(r.impressions ?? 0)}</td>
                    <td className="py-2.5 px-5 text-right font-mono font-semibold text-[12px] text-emerald-400">{fmtMoney(r.revenue_usd ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Quick actions ────────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-3" style={{ color: C.dim }}>Quick Actions</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {[
            { href:'/admin/articles/new',                     icon:'✏️', label:'New Article'   },
            { href:'/admin/ai-writer',                        icon:'🤖', label:'AI Writer'     },
            { href:'/admin/trends',                           icon:'🔥', label:'Trends'        },
            { href:'/admin/seo',                              icon:'🎯', label:'SEO Engine'    },
            { href:'/admin/monetization/ad-networks',         icon:'📡', label:'Ad Networks'   },
            { href:'/admin/reports',                          icon:'📊', label:'Reports'       },
          ].map(a => (
            <Link
              key={a.href}
              href={a.href}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-colors"
              style={{ background: C.elevated, border: `1px solid ${C.border}` }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1a2840')}
              onMouseLeave={e => (e.currentTarget.style.background = C.elevated)}
            >
              <span className="text-xl">{a.icon}</span>
              <span className="text-[11px] font-medium" style={{ color: C.muted }}>{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
