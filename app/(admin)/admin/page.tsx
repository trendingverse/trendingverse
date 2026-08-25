// app/(admin)/admin/page.tsx
// Safe version — all queries wrapped in try/catch, dynamic chart imports

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import dynamic from 'next/dynamic'

export const dynamic_   = 'force-dynamic'
export const revalidate = 0

/* ─── Dynamic imports so chart errors never crash the page ───────── */
const RevenueAreaChart = dynamic(
  () => import('./_components/DashboardCharts').then(m => m.RevenueAreaChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
)
const ImpressionsBarChart = dynamic(
  () => import('./_components/DashboardCharts').then(m => m.ImpressionsBarChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
)
const NetworkBarChart = dynamic(
  () => import('./_components/DashboardCharts').then(m => m.NetworkBarChart),
  { ssr: false, loading: () => <ChartSkeleton /> }
)

/* ─── Formatters ─────────────────────────────────────────────────── */
const fmtMoney = (n: number) => n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`
const fmtK     = (n: number) => n >= 1_000_000 ? `${(n/1e6).toFixed(1)}M` : n >= 1_000 ? `${(n/1e3).toFixed(1)}k` : String(n)
const fmtDate  = (iso: string) => { try { return new Date(iso).toLocaleDateString('en-IN', { month:'short', day:'numeric' }) } catch { return iso } }

/* ─── Tokens ─────────────────────────────────────────────────────── */
const C = {
  surface:  '#0e1726',
  elevated: '#131f33',
  border:   '#1a2840',
  borderDim:'#111e30',
  text:     '#dde4f0',
  muted:    '#6b82a8',
  dim:      '#2d3f58',
}

/* ─── UI atoms ───────────────────────────────────────────────────── */
function Card({ children, className='' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl ${className}`} style={{ background: C.surface, border:`1px solid ${C.border}` }}>
      {children}
    </div>
  )
}
function Stat({ label, value, sub, color }: { label:string; value:string; sub?:string; color:string }) {
  return (
    <Card>
      <div className="p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: C.dim }}>{label}</p>
        <p className={`text-[28px] font-mono font-bold leading-none ${color}`}>{value}</p>
        {sub && <p className="text-[12px] mt-1.5" style={{ color: C.muted }}>{sub}</p>}
      </div>
    </Card>
  )
}
function SectionHead({ title, action }: { title:string; action?: {label:string; href:string} }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: C.dim }}>{title}</h2>
      {action && <Link href={action.href} className="text-[12px] font-medium text-red-500 hover:text-red-400">{action.label} →</Link>}
    </div>
  )
}
function ChartSkeleton() {
  return <div className="h-48 rounded-lg animate-pulse" style={{ background: C.elevated }} />
}
function StatusDot({ on }: { on: boolean }) {
  return <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${on ? 'bg-emerald-500' : 'bg-slate-700'}`} />
}

/* ─── Safe Supabase helper ───────────────────────────────────────── */
async function safeQuery<T>(fn: () => Promise<{ data: T | null; error: unknown }>): Promise<T | null> {
  try {
    const { data, error } = await fn()
    if (error) {
      console.error('[Dashboard query error]', error)
      return null
    }
    return data
  } catch (e) {
    console.error('[Dashboard query threw]', e)
    return null
  }
}

/* ─── Page ───────────────────────────────────────────────────────── */
export default async function AdminDashboard() {
  const supabase = await createClient()
  const now      = new Date()
  const todayISO = now.toISOString().slice(0, 10)
  const d7       = new Date(now); d7.setDate(now.getDate() - 7)
  const d14      = new Date(now); d14.setDate(now.getDate() - 14)
  const d30      = new Date(now); d30.setDate(now.getDate() - 30)

  /* ── All queries safe — never throw ───────────────────────────── */
  const [totalArticles, draftCount, pubToday, revRows, articles, adNetworks, sites, recentRev] = await Promise.all([
    safeQuery(() => supabase.from('articles').select('id', { count:'exact', head:true })),
    safeQuery(() => supabase.from('articles').select('id', { count:'exact', head:true }).eq('status','draft')),
    safeQuery(() => supabase.from('articles').select('id', { count:'exact', head:true }).eq('status','published').gte('published_at', todayISO + 'T00:00:00Z')),
    safeQuery(() =>
      supabase.from('partner_revenue')
        .select('date, revenue_usd, impressions, network_name')
        .gte('date', d30.toISOString().slice(0,10))
        .order('date', { ascending: true })
    ),
    safeQuery(() =>
      supabase.from('articles')
        .select('id, title, status, published_at')
        .order('created_at', { ascending: false })
        .limit(10)
    ),
    safeQuery(() => supabase.from('ad_networks').select('id, name, is_active, priority').order('priority', { ascending:true })),
    safeQuery(() => supabase.from('sites').select('id, name, site_url, is_active').limit(6)),
    safeQuery(() =>
      supabase.from('partner_revenue')
        .select('date, network_name, revenue_usd, impressions, site_url')
        .order('date', { ascending: false })
        .limit(8)
    ),
  ])

  /* ── Aggregations ──────────────────────────────────────────────── */
  type RevRow = { date: string; revenue_usd?: number | null; impressions?: number | null; network_name?: string | null; site_url?: string | null }
  const rows      = (revRows ?? []) as RevRow[]
  const todayRev  = rows.filter(r => r.date === todayISO).reduce((s,r) => s + (r.revenue_usd ?? 0), 0)
  const weekRev   = rows.filter(r => r.date >= d7.toISOString().slice(0,10)).reduce((s,r) => s + (r.revenue_usd ?? 0), 0)
  const monthRev  = rows.reduce((s,r) => s + (r.revenue_usd ?? 0), 0)
  const monthImpr = rows.reduce((s,r) => s + (r.impressions ?? 0), 0)
  const todayImpr = rows.filter(r => r.date === todayISO).reduce((s,r) => s + (r.impressions ?? 0), 0)
  const cpm       = monthImpr > 0 ? (monthRev / monthImpr) * 1000 : 0

  /* ── 14-day chart data ─────────────────────────────────────────── */
  const chartDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - 13 + i)
    return d.toISOString().slice(0,10)
  })
  const chartData = chartDays.map(date => ({
    date: date.slice(5),
    revenue:     rows.filter(r => r.date === date).reduce((s,r) => s + (r.revenue_usd ?? 0), 0),
    impressions: rows.filter(r => r.date === date).reduce((s,r) => s + (r.impressions ?? 0), 0),
  }))

  /* ── Network breakdown ─────────────────────────────────────────── */
  const netMap: Record<string,number> = {}
  rows.forEach(r => { const n = r.network_name ?? 'Unknown'; netMap[n] = (netMap[n]??0) + (r.revenue_usd??0) })
  const netData = Object.entries(netMap).map(([network, revenue]) => ({ network, revenue })).sort((a,b) => b.revenue-a.revenue)

  type Article = { id: string; title: string; status: string; published_at?: string | null }
  type Network = { id: string; name: string; is_active: boolean; priority: number }
  type Site    = { id: string; name?: string | null; site_url: string; is_active: boolean }

  /* ─────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6 pb-8" style={{ color: C.text }}>

      {/* Header */}
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
          <Link href="/admin/ai-writer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium" style={{ background: C.elevated, border:`1px solid ${C.border}`, color: C.muted }}>
            ✦ AI Writer
          </Link>
          <Link href="/admin/articles/new" className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-semibold text-white" style={{ background:'#dc2626' }}>
            + New Article
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Revenue today"    value={fmtMoney(todayRev)}  sub={`${fmtMoney(weekRev)} this week`}  color="text-emerald-400" />
        <Stat label="Revenue (30d)"    value={fmtMoney(monthRev)}  sub={`CPM $${cpm.toFixed(2)}`}           color="text-sky-400" />
        <Stat label="Impressions (30d)" value={fmtK(monthImpr)}   sub={`${fmtK(todayImpr)} today`}          color="text-violet-400" />
        <Stat label="Total articles"   value={String((totalArticles as { count?: number } | null)?.count ?? 0)}
          sub={`${(draftCount as { count?: number } | null)?.count ?? 0} drafts · ${(pubToday as { count?: number } | null)?.count ?? 0} today`}
          color="text-amber-400" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <SectionHead title="Revenue — 14 Days" action={{ label:'Full report', href:'/admin/revenue' }} />
          <RevenueAreaChart data={chartData} />
        </Card>
        <Card className="p-5">
          <SectionHead title="By Network" />
          {netData.length > 0 ? (
            <>
              <NetworkBarChart data={netData} />
              <div className="mt-4 pt-4 space-y-2" style={{ borderTop:`1px solid ${C.borderDim}` }}>
                {netData.map(n => (
                  <div key={n.network} className="flex items-center justify-between">
                    <span className="text-[12px]" style={{ color:C.muted }}>{n.network}</span>
                    <span className="text-[12px] font-mono font-semibold text-emerald-400">{fmtMoney(n.revenue)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center gap-2" style={{ color:C.dim }}>
              <span className="text-2xl">📡</span>
              <p className="text-[12px]">No network data yet</p>
              <Link href="/admin/monetization/ad-networks" className="text-[11px] text-red-500 hover:text-red-400">Connect networks →</Link>
            </div>
          )}
        </Card>
      </div>

      {/* Impressions */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <SectionHead title="Impressions — 14 Days" />
          <ImpressionsBarChart data={chartData} />
        </Card>

        {/* Recent activity table */}
        {(recentRev as RevRow[] | null)?.length ? (
          <Card className="overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom:`1px solid ${C.borderDim}` }}>
              <SectionHead title="Revenue Activity" action={{ label:'View all', href:'/admin/revenue' }} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ borderBottom:`1px solid ${C.borderDim}` }}>
                    {['Date','Network','Impressions','Revenue'].map((h,i) => (
                      <th key={h} className={`py-2.5 px-4 text-[10px] font-semibold uppercase tracking-widest ${i>=2?'text-right':'text-left'}`} style={{ color:C.dim }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {((recentRev as RevRow[]) ?? []).map((r,i) => (
                    <tr key={i} style={{ borderBottom:`1px solid ${C.borderDim}` }}>
                      <td className="py-2.5 px-4 font-mono" style={{ color:C.dim }}>{r.date}</td>
                      <td className="py-2.5 px-4" style={{ color:C.text }}>{r.network_name}</td>
                      <td className="py-2.5 px-4 text-right font-mono" style={{ color:C.muted }}>{fmtK(r.impressions??0)}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-400">{fmtMoney(r.revenue_usd??0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="p-5 flex items-center justify-center" style={{ color:C.dim }}>
            <p className="text-[13px]">Revenue data will appear here once networks are connected.</p>
          </Card>
        )}
      </div>

      {/* Articles + Infrastructure */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom:`1px solid ${C.borderDim}` }}>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color:C.dim }}>Recent Articles</h2>
            <Link href="/admin/articles" className="text-[12px] text-red-500 hover:text-red-400">All articles →</Link>
          </div>
          {((articles as Article[]|null) ?? []).length === 0 ? (
            <p className="text-[13px] text-center py-8" style={{ color:C.dim }}>
              No articles yet. <Link href="/admin/articles/new" className="text-red-500">Create one →</Link>
            </p>
          ) : (
            <div>
              {((articles as Article[]) ?? []).map(a => {
                const statusColor: Record<string,string> = {
                  published:'bg-emerald-500/10 text-emerald-400',
                  draft:'bg-slate-800 text-slate-500',
                  scheduled:'bg-amber-500/10 text-amber-400',
                }
                return (
                  <div key={a.id} className="flex items-center gap-3 px-5 py-3 group transition-colors hover:bg-white/[0.02]" style={{ borderBottom:`1px solid ${C.borderDim}` }}>
                    <div className="flex-1 min-w-0">
                      <Link href={`/admin/articles/${a.id}/edit`} className="text-[13px] font-medium truncate block hover:text-white transition-colors" style={{ color:C.text }}>{a.title}</Link>
                      {a.published_at && <span className="text-[11px]" style={{ color:C.dim }}>{fmtDate(a.published_at)}</span>}
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor[a.status]??statusColor.draft}`}>{a.status}</span>
                    <Link href={`/admin/articles/${a.id}/edit`} className="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ color:C.muted }}>Edit</Link>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionHead title="Ad Networks" action={{ label:'Manage', href:'/admin/monetization/ad-networks' }} />
            <div className="space-y-2.5">
              {((adNetworks as Network[]|null) ?? []).length === 0 ? (
                <Link href="/admin/monetization/ad-networks" className="text-[12px] text-red-500 block text-center py-3">+ Connect first network</Link>
              ) : (
                ((adNetworks as Network[]) ?? []).map(n => (
                  <div key={n.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusDot on={n.is_active} />
                      <span className="text-[13px]" style={{ color:n.is_active?C.text:C.dim }}>{n.name}</span>
                    </div>
                    <span className={`text-[11px] font-semibold ${n.is_active?'text-emerald-500':'text-slate-700'}`}>{n.is_active?'Live':'Off'}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
          <Card className="p-4">
            <SectionHead title="Publisher Sites" action={{ label:'Manage', href:'/admin/monetization' }} />
            <div className="space-y-2.5">
              {((sites as Site[]|null) ?? []).map(s => (
                <div key={s.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot on={s.is_active} />
                    <span className="text-[13px] truncate" style={{ color:s.is_active?C.text:C.dim }}>{s.name||s.site_url}</span>
                  </div>
                  <span className={`text-[11px] flex-shrink-0 ${s.is_active?'text-sky-500':'text-slate-700'}`}>{s.is_active?'Live':'—'}</span>
                </div>
              ))}
              {((sites as Site[]|null)??[]).length===0 && <p className="text-[12px] text-center py-3" style={{ color:C.dim }}>No sites yet</p>}
            </div>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-3" style={{ color:C.dim }}>Quick Actions</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            {href:'/admin/articles/new',                  icon:'✏️', label:'New Article'},
            {href:'/admin/ai-writer',                     icon:'🤖', label:'AI Writer'},
            {href:'/admin/trends',                        icon:'🔥', label:'Trends'},
            {href:'/admin/seo',                           icon:'🎯', label:'SEO'},
            {href:'/admin/monetization/ad-networks',      icon:'📡', label:'Ad Networks'},
            {href:'/admin/reports',                       icon:'📊', label:'Reports'},
          ].map(a => (
            <Link key={a.href} href={a.href}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-colors hover:bg-white/[0.04]"
              style={{ background:C.elevated, border:`1px solid ${C.border}` }}>
              <span className="text-xl">{a.icon}</span>
              <span className="text-[11px] font-medium" style={{ color:C.muted }}>{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
