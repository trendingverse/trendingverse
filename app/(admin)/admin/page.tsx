import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  RevenueChart,
  ImpressionsChart,
  NetworkChart,
  ViewsChart,
} from './_components/DashboardCharts'

/* ─────────────────────────────────────────────────────────────────────
   TrendingVerse Pro — Admin Dashboard
   File: app/(admin)/admin/page.tsx
   ───────────────────────────────────────────────────────────────────── */

export const dynamic   = 'force-dynamic'
export const revalidate = 0

/* ─── Helpers ─────────────────────────────────────────────────────── */
function fmtUSD(n: number) {
  if (n >= 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}
function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}
function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

/* ─── Tiny server-side components ────────────────────────────────── */
function KpiCard({
  label, value, sub, color = 'text-white', icon,
}: {
  label: string; value: string; sub?: string; color?: string; icon: string
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-xl flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${color} font-mono`}>{value}</p>
        {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function SectionHead({ title, href, label = 'See all' }: { title: string; href?: string; label?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">{title}</h2>
      {href && (
        <Link href={href} className="text-xs text-red-500 hover:text-red-400 font-medium transition-colors">
          {label} →
        </Link>
      )}
    </div>
  )
}

/* ─── Status badge ───────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: 'bg-emerald-500/15 text-emerald-400',
    draft:     'bg-slate-700 text-slate-400',
    scheduled: 'bg-amber-500/15 text-amber-400',
    archived:  'bg-slate-800 text-slate-600',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? map.draft}`}>
      {status}
    </span>
  )
}

/* ─── Quick action button ─────────────────────────────────────────── */
function QuickAction({ href, icon, label, sub, color = 'bg-slate-800 hover:bg-slate-700' }: {
  href: string; icon: string; label: string; sub: string; color?: string
}) {
  return (
    <Link href={href} className={`${color} border border-slate-700/50 rounded-xl p-4 flex items-center gap-3 transition-colors group`}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-slate-200 group-hover:text-white">{label}</p>
        <p className="text-xs text-slate-500">{sub}</p>
      </div>
    </Link>
  )
}

/* ─── Page ────────────────────────────────────────────────────────── */
export default async function AdminDashboard() {
  const supabase = await createClient()

  const now      = new Date()
  const todayISO = now.toISOString().slice(0, 10)
  const todayStart = todayISO + 'T00:00:00Z'
  const todayEnd   = todayISO + 'T23:59:59Z'

  // 7-day window
  const d7 = new Date(now); d7.setDate(now.getDate() - 7)
  const w7ISO = d7.toISOString().slice(0, 10) + 'T00:00:00Z'

  // 30-day window
  const d30 = new Date(now); d30.setDate(now.getDate() - 30)
  const d30ISO = d30.toISOString().slice(0, 10) + 'T00:00:00Z'

  /* ── Parallel data fetching ────────────────────────────────────── */
  const [
    { count: totalArticles },
    { count: publishedToday },
    { count: draftCount },
    { data: revenueRows },
    { data: recentArticles },
    { data: topArticles },
    { data: adNetworks },
    { data: sites },
    { data: recentActivity },
  ] = await Promise.all([
    // Article counts
    supabase.from('articles').select('*', { count: 'exact', head: true }),
    supabase.from('articles').select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('published_at', todayStart)
      .lte('published_at', todayEnd),
    supabase.from('articles').select('*', { count: 'exact', head: true })
      .eq('status', 'draft'),

    // Revenue — last 30 days from partner_revenue
    supabase.from('partner_revenue')
      .select('date, revenue_usd, impressions, network_name')
      .gte('date', d30.toISOString().slice(0, 10))
      .order('date', { ascending: true }),

    // Recent articles
    supabase.from('articles')
      .select('id, title, status, published_at, category_name, view_count, seo_score')
      .order('created_at', { ascending: false })
      .limit(8),

    // Top articles by views
    supabase.from('articles')
      .select('id, title, view_count, category_name, status')
      .eq('status', 'published')
      .order('view_count', { ascending: false })
      .limit(5),

    // Ad networks
    supabase.from('ad_networks')
      .select('id, name, is_active, priority')
      .order('priority', { ascending: true })
      .limit(10),

    // Publisher sites
    supabase.from('sites')
      .select('id, name, site_url, is_active')
      .limit(6),

    // Recent partner_revenue for activity feed
    supabase.from('partner_revenue')
      .select('date, network_name, revenue_usd, impressions, site_url')
      .order('date', { ascending: false })
      .limit(6),
  ])

  /* ── Aggregate revenue numbers ─────────────────────────────────── */
  const rows = revenueRows ?? []

  const todayRev  = rows.filter(r => r.date === todayISO)
    .reduce((s, r) => s + (r.revenue_usd ?? 0), 0)

  const week7Rev  = rows.filter(r => r.date >= d7.toISOString().slice(0, 10))
    .reduce((s, r) => s + (r.revenue_usd ?? 0), 0)

  const month30Rev = rows.reduce((s, r) => s + (r.revenue_usd ?? 0), 0)

  const todayImpr  = rows.filter(r => r.date === todayISO)
    .reduce((s, r) => s + (r.impressions ?? 0), 0)

  const month30Impr = rows.reduce((s, r) => s + (r.impressions ?? 0), 0)

  // CPM
  const cpm = month30Impr > 0 ? (month30Rev / month30Impr) * 1000 : 0

  /* ── Chart data: 14-day daily revenue ─────────────────────────── */
  const chartDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - 13 + i)
    return d.toISOString().slice(0, 10)
  })

  const revenueChartData = chartDays.map(date => {
    const dayRows = rows.filter(r => r.date === date)
    return {
      date: date.slice(5),
      revenue:     dayRows.reduce((s, r) => s + (r.revenue_usd ?? 0), 0),
      impressions: dayRows.reduce((s, r) => s + (r.impressions ?? 0), 0),
    }
  })

  /* ── Per-network breakdown ─────────────────────────────────────── */
  const networkMap: Record<string, { revenue: number; impressions: number }> = {}
  rows.forEach(r => {
    const n = r.network_name ?? 'Unknown'
    if (!networkMap[n]) networkMap[n] = { revenue: 0, impressions: 0 }
    networkMap[n].revenue     += r.revenue_usd ?? 0
    networkMap[n].impressions += r.impressions ?? 0
  })
  const networkChartData = Object.entries(networkMap)
    .map(([network, d]) => ({
      network,
      revenue:     d.revenue,
      impressions: d.impressions,
      cpm: d.impressions > 0 ? (d.revenue / d.impressions) * 1000 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  /* ── Article views placeholder (from view_count field) ─────────── */
  const totalViews = (topArticles ?? []).reduce((s, a) => s + (a.view_count ?? 0), 0)

  /* ─────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-8">

        {/* ── PAGE HEADER ──────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-mono">LIVE</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/articles/new"
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              + New Article
            </Link>
            <Link
              href="/admin/trends"
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold px-4 py-2 rounded-lg border border-slate-700 transition-colors"
            >
              🔥 Trends
            </Link>
          </div>
        </div>

        {/* ── KPI STRIP ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon="💰"
            label="Revenue today"
            value={fmtUSD(todayRev)}
            sub={`$${week7Rev.toFixed(3)} this week`}
            color="text-emerald-400"
          />
          <KpiCard
            icon="📈"
            label="Revenue (30d)"
            value={fmtUSD(month30Rev)}
            sub={`CPM: $${cpm.toFixed(2)}`}
            color="text-sky-400"
          />
          <KpiCard
            icon="👁"
            label="Impressions today"
            value={fmtNum(todayImpr)}
            sub={`${fmtNum(month30Impr)} this month`}
            color="text-violet-400"
          />
          <KpiCard
            icon="📝"
            label="Total articles"
            value={String(totalArticles ?? 0)}
            sub={`${publishedToday ?? 0} published today · ${draftCount ?? 0} drafts`}
            color="text-amber-400"
          />
        </div>

        {/* ── REVENUE CHARTS ───────────────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-4">

          {/* Revenue trend — 14 day */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
            <SectionHead title="Revenue — Last 14 Days" href="/admin/revenue" label="Full report" />
            <RevenueChart data={revenueChartData} />
          </div>

          {/* Network breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <SectionHead title="Revenue by Network" />
            {networkChartData.length > 0 ? (
              <>
                <NetworkChart data={networkChartData} />
                <div className="mt-4 space-y-2 border-t border-slate-800 pt-4">
                  {networkChartData.map(n => (
                    <div key={n.network} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">{n.network}</span>
                      <div className="flex items-center gap-3 text-right">
                        <span className="text-slate-600">{fmtNum(n.impressions)} impr</span>
                        <span className="text-emerald-400 font-mono font-semibold">{fmtUSD(n.revenue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-slate-600">
                <span className="text-3xl">📡</span>
                <p className="text-sm">No network data yet</p>
                <Link href="/admin/monetization/ad-networks" className="text-xs text-red-500 hover:text-red-400">
                  Connect Ad Networks →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── IMPRESSIONS + ARTICLE VIEWS ──────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <SectionHead title="Impressions — Last 14 Days" />
            <ImpressionsChart data={revenueChartData} />
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <SectionHead title="Top Articles by Views" href="/admin/articles" />
            <div className="space-y-3 mt-1">
              {(topArticles ?? []).length === 0 && (
                <p className="text-sm text-slate-600 py-6 text-center">No articles yet</p>
              )}
              {(topArticles ?? []).map((a, i) => (
                <div key={a.id} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-700 w-5 text-right flex-shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/admin/articles/${a.id}/edit`}
                      className="text-sm text-slate-300 hover:text-white font-medium truncate block transition-colors"
                    >
                      {a.title}
                    </Link>
                    <span className="text-xs text-slate-600">{a.category_name || 'Uncategorized'}</span>
                  </div>
                  <span className="text-xs font-mono text-violet-400 flex-shrink-0">
                    {fmtNum(a.view_count ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RECENT ARTICLES + AD NETWORKS ────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-4">

          {/* Recent articles */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Recent Articles</h2>
              <Link href="/admin/articles" className="text-xs text-red-500 hover:text-red-400 font-medium transition-colors">
                All articles →
              </Link>
            </div>
            <div className="divide-y divide-slate-800/60">
              {(recentArticles ?? []).length === 0 && (
                <p className="text-sm text-slate-600 p-6 text-center">
                  No articles yet.{' '}
                  <Link href="/admin/articles/new" className="text-red-500 hover:text-red-400">Create one →</Link>
                </p>
              )}
              {(recentArticles ?? []).map(a => (
                <div key={a.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-800/40 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/admin/articles/${a.id}/edit`}
                      className="text-sm text-slate-200 group-hover:text-white font-medium truncate block transition-colors"
                    >
                      {a.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-600">{a.category_name || 'Uncategorized'}</span>
                      {a.published_at && (
                        <>
                          <span className="text-slate-700">·</span>
                          <span className="text-xs text-slate-600">{shortDate(a.published_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {a.seo_score != null && (
                      <span className={`text-xs font-mono font-semibold ${
                        (a.seo_score) >= 70 ? 'text-emerald-400' :
                        (a.seo_score) >= 40 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {a.seo_score}
                      </span>
                    )}
                    <StatusBadge status={a.status} />
                    <Link
                      href={`/admin/articles/${a.id}/edit`}
                      className="text-xs text-slate-600 hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ad networks + sites */}
          <div className="space-y-4">
            {/* Ad networks status */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <SectionHead title="Ad Networks" href="/admin/monetization/ad-networks" label="Manage" />
              <div className="space-y-2.5">
                {(adNetworks ?? []).length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-sm text-slate-600 mb-2">No networks connected</p>
                    <Link href="/admin/monetization/ad-networks" className="text-xs text-red-500 hover:text-red-400">
                      + Connect network →
                    </Link>
                  </div>
                )}
                {(adNetworks ?? []).map(n => (
                  <div key={n.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${n.is_active ? 'bg-emerald-400' : 'bg-slate-700'}`} />
                      <span className="text-sm text-slate-300">{n.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">P{n.priority}</span>
                      <span className={`text-xs font-medium ${n.is_active ? 'text-emerald-500' : 'text-slate-600'}`}>
                        {n.is_active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Publisher sites */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <SectionHead title="Publisher Sites" href="/admin/monetization" label="Manage" />
              <div className="space-y-2.5">
                {(sites ?? []).length === 0 && (
                  <p className="text-sm text-slate-600 text-center py-3">No sites yet</p>
                )}
                {(sites ?? []).map(s => (
                  <div key={s.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.is_active ? 'bg-sky-400' : 'bg-slate-700'}`} />
                      <span className="text-sm text-slate-300 truncate">{s.name || s.site_url}</span>
                    </div>
                    <span className={`text-xs flex-shrink-0 ${s.is_active ? 'text-sky-500' : 'text-slate-600'}`}>
                      {s.is_active ? 'Live' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── RECENT REVENUE ACTIVITY ───────────────────────────────── */}
        {(recentActivity ?? []).length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <SectionHead title="Recent Revenue Activity" href="/admin/revenue" label="View earnings" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-600 uppercase tracking-wide border-b border-slate-800">
                    <th className="text-left py-2 pr-4 font-medium">Date</th>
                    <th className="text-left py-2 pr-4 font-medium">Network</th>
                    <th className="text-left py-2 pr-4 font-medium">Site</th>
                    <th className="text-right py-2 pr-4 font-medium">Impressions</th>
                    <th className="text-right py-2 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {(recentActivity ?? []).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 pr-4 text-slate-500 font-mono text-xs">{r.date}</td>
                      <td className="py-2.5 pr-4 text-slate-300">{r.network_name}</td>
                      <td className="py-2.5 pr-4 text-slate-500 text-xs truncate max-w-[160px]">{r.site_url}</td>
                      <td className="py-2.5 pr-4 text-right text-slate-400 font-mono text-xs">{fmtNum(r.impressions ?? 0)}</td>
                      <td className="py-2.5 text-right text-emerald-400 font-mono font-semibold text-xs">{fmtUSD(r.revenue_usd ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── QUICK ACTIONS ─────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <QuickAction href="/admin/articles/new"           icon="✏️" label="New Article"      sub="Write & publish"      />
            <QuickAction href="/admin/ai-writer"              icon="🤖" label="AI Writer"        sub="Generate content"     />
            <QuickAction href="/admin/trends"                 icon="🔥" label="Trending"         sub="Today's hot topics"   />
            <QuickAction href="/admin/seo"                    icon="🎯" label="SEO Engine"       sub="Optimize articles"    />
            <QuickAction href="/admin/monetization/ad-networks" icon="📡" label="Ad Networks"   sub="Manage waterfall"     />
            <QuickAction href="/admin/reports"                icon="📊" label="Reports"          sub="Delivery & fill"      />
          </div>
        </div>

        {/* ── FOOTER ───────────────────────────────────────────────── */}
        <div className="border-t border-slate-800/60 pt-6 flex items-center justify-between text-xs text-slate-700">
          <span>TrendingVerse Pro · Dashboard</span>
          <span>Data refreshes on page load</span>
        </div>

      </div>
    </div>
  )
}
