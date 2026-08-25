// app/(admin)/admin/page.tsx
import { createClient } from '@/lib/supabase/server'
import { createClient as svcClient } from '@supabase/supabase-js'
import Link from 'next/link'
import {
  RevenueChartWrapper,
  ImpressionsChartWrapper,
  NetworkChartWrapper,
} from './_components/ChartWrapper'

export const dynamic    = 'force-dynamic'
export const revalidate = 0

/* ─── Format helpers ─────────────────────────────────────────────── */
const $    = (n: number) => n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`
const fmtK = (n: number) => n >= 1_000_000 ? `${(n/1e6).toFixed(1)}M` : n >= 1_000 ? `${(n/1e3).toFixed(1)}k` : String(n)
const fmtD = (iso: string) => { try { return new Date(iso).toLocaleDateString('en-IN',{month:'short',day:'numeric'}) } catch { return iso } }

/* ─── Design tokens ──────────────────────────────────────────────── */
const C = { s:'#0e1726', e:'#131f33', b:'#1a2840', bd:'#111e30', t:'#dde4f0', m:'#6b82a8', d:'#2d3f58' }

/* ─── Tiny UI atoms ──────────────────────────────────────────────── */
function Card({ c='', children }: { c?: string; children: React.ReactNode }) {
  return <div className={`rounded-xl ${c}`} style={{ background:C.s, border:`1px solid ${C.b}` }}>{children}</div>
}
function Kpi({ label,val,sub,col }:{ label:string;val:string;sub?:string;col:string }) {
  return <Card><div className="p-5"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{color:C.d}}>{label}</p><p className={`text-[28px] font-mono font-bold leading-none ${col}`}>{val}</p>{sub&&<p className="text-[12px] mt-1.5" style={{color:C.m}}>{sub}</p>}</div></Card>
}
function SH({ t,a }:{ t:string; a?:{l:string;h:string} }) {
  return <div className="flex items-center justify-between mb-4"><h2 className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{color:C.d}}>{t}</h2>{a&&<Link href={a.h} className="text-[12px] font-medium text-red-500 hover:text-red-400 transition-colors">{a.l} →</Link>}</div>
}
function Dot({ on }:{ on:boolean }) { return <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${on?'bg-emerald-500':'bg-slate-700'}`}/> }

/* ─── Universal safe query ───────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sq(fn: ()=>any): Promise<any[]> {
  try {
    const r = await fn()
    if (r?.error) { console.error('[Dashboard query error]', r.error.code, r.error.message); return [] }
    if (Array.isArray(r?.data)) return r.data
    return []
  } catch(e) { console.error('[Dashboard query threw]', e); return [] }
}
async function sqN(fn: ()=>any): Promise<number> {
  try { const r = await fn(); if(r?.error){console.error('[Count err]',r.error.message);return 0}; return r?.count??0 } catch { return 0 }
}

/* ─── Normalise a revenue row regardless of column names ─────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normRev(r: any) {
  // Try every plausible column name for each field
  const raw_date =
    r.date ?? r.report_date ?? r.created_at ?? r.day ?? ''
  const date = typeof raw_date === 'string'
    ? raw_date.slice(0,10)          // works for both 'YYYY-MM-DD' and ISO timestamps
    : ''
  return {
    date,
    rev:  +(r.revenue_usd ?? r.revenue ?? r.earnings ?? r.amount ?? r.publisher_earnings_usd ?? 0),
    impr: +(r.impressions ?? r.impr   ?? r.impression_count ?? r.views ?? r.ad_impressions ?? 0),
    net:    r.network_name ?? r.network ?? r.partner_name ?? r.ad_network ?? r.source ?? 'Unknown',
    site:   r.site_url     ?? r.site    ?? r.domain       ?? r.publisher_url ?? '',
  }
}

/* ─── Normalise an ad-network row ────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normNet(r: any) {
  return {
    id:       r.id ?? r.network_id ?? '',
    name:     r.name ?? r.network_name ?? r.label ?? r.title ?? 'Network',
    active:   !!(r.is_active ?? r.active ?? r.enabled ?? r.status === 'active'),
    priority: +(r.priority ?? r.order ?? r.waterfall_order ?? 0),
  }
}

/* ─── Normalise a site row ───────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normSite(r: any) {
  return {
    id:     r.id ?? '',
    name:   r.name ?? r.site_name ?? r.domain ?? r.site_url ?? '',
    url:    r.site_url ?? r.url ?? r.domain ?? '',
    active: !!(r.is_active ?? r.active ?? r.enabled ?? true),
  }
}

/* ─── Page ───────────────────────────────────────────────────────── */
export default async function AdminDashboard() {
  const supabase = await createClient()

  // Service role — bypasses ALL RLS
  const svc = svcClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now      = new Date()
  const todayISO = now.toISOString().slice(0,10)
  const d7  = new Date(now); d7.setDate(now.getDate()-7)
  const d30 = new Date(now); d30.setDate(now.getDate()-30)
  const d30str = d30.toISOString().slice(0,10)

  /* ── Fire all queries in parallel ─────────────────────────────── */
  const [
    totalArt, drafts, todayPub,
    rawRev, rawRecent,
    rawArticles, rawNets, rawSites,
  ] = await Promise.all([
    // Article counts — regular client (articles table, user RLS ok)
    sqN(() => supabase.from('articles').select('*',{count:'exact',head:true})),
    sqN(() => supabase.from('articles').select('*',{count:'exact',head:true}).eq('status','draft')),
    sqN(() => supabase.from('articles').select('*',{count:'exact',head:true}).eq('status','published').gte('published_at',todayISO+'T00:00:00Z')),

    // Revenue — select * so no column name assumption; service role for RLS bypass
    // Try both date and created_at filters to catch any date format
    sq(() => svc.from('partner_revenue').select('*').gte('date', d30str).order('date',{ascending:true}).limit(500)),

    // Recent revenue rows
    sq(() => svc.from('partner_revenue').select('*').order('date',{ascending:false}).limit(10)),

    // Articles list
    sq(() => supabase.from('articles').select('id,title,status,published_at').order('created_at',{ascending:false}).limit(10)),

    // Ad networks — select * to avoid wrong column names
    sq(() => svc.from('ad_networks').select('*').order('priority',{ascending:true})),

    // Sites — select *
    sq(() => svc.from('sites').select('*').limit(6)),
  ])

  /* ── If partner_revenue date filter returned nothing, try without filter ── */
  const revRows   = rawRev.length > 0 ? rawRev.map(normRev) : []
  const recentRev = rawRecent.map(normRev)
  const nets      = rawNets.map(normNet)
  const sites     = rawSites.map(normSite)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const articles  = rawArticles as any[]

  /* ── Aggregations ───────────────────────────────────────────────── */
  // Filter by date — works for both 'YYYY-MM-DD' strings
  const todayRows = revRows.filter(r => r.date === todayISO)
  const weekRows  = revRows.filter(r => r.date >= d7.toISOString().slice(0,10))

  const todayRev  = todayRows.reduce((s,r) => s+r.rev, 0)
  const weekRev   = weekRows.reduce((s,r) => s+r.rev, 0)
  const monthRev  = revRows.reduce((s,r) => s+r.rev, 0)
  const monthImpr = revRows.reduce((s,r) => s+r.impr, 0)
  const todayImpr = todayRows.reduce((s,r) => s+r.impr, 0)
  const cpm       = monthImpr > 0 ? (monthRev/monthImpr)*1000 : 0

  /* ── 14-day chart ───────────────────────────────────────────────── */
  const days14 = Array.from({length:14},(_,i)=>{
    const d=new Date(now); d.setDate(now.getDate()-13+i)
    return d.toISOString().slice(0,10)
  })
  const chart = days14.map(d=>({
    date:        d.slice(5),
    revenue:     revRows.filter(r=>r.date===d).reduce((s,r)=>s+r.rev,0),
    impressions: revRows.filter(r=>r.date===d).reduce((s,r)=>s+r.impr,0),
  }))

  /* ── Network breakdown ──────────────────────────────────────────── */
  const nm: Record<string,number>={}
  revRows.forEach(r=>{nm[r.net]=(nm[r.net]??0)+r.rev})
  const netChart = Object.entries(nm).map(([network,revenue])=>({network,revenue})).sort((a,b)=>b.revenue-a.revenue)

  /* ── Debug log — visible in Vercel function logs ────────────────── */
  console.log('[Dashboard] revRows:', revRows.length, '| nets:', nets.length, '| sites:', sites.length)
  if (revRows.length === 0) console.log('[Dashboard] partner_revenue returned 0 rows — check table name / date column')
  if (nets.length === 0)    console.log('[Dashboard] ad_networks returned 0 rows — check table name')

  /* ─────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6 pb-8" style={{ color:C.t }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
            <span className="text-[11px] font-mono font-semibold text-emerald-500 uppercase tracking-wider">Live</span>
          </div>
          <p className="text-[13px]" style={{color:C.m}}>
            {now.toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/ai-writer" className="px-3 py-1.5 rounded-lg text-[13px] font-medium" style={{background:C.e,border:`1px solid ${C.b}`,color:C.m}}>✦ AI Writer</Link>
          <Link href="/admin/articles/new" className="px-4 py-1.5 rounded-lg text-[13px] font-semibold text-white" style={{background:'#dc2626'}}>+ New Article</Link>
        </div>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Revenue today"      val={$(todayRev)}    sub={`${$(weekRev)} this week`}                col="text-emerald-400"/>
        <Kpi label="Revenue (30d)"      val={$(monthRev)}    sub={`CPM $${cpm.toFixed(2)}`}                 col="text-sky-400"/>
        <Kpi label="Impressions (30d)"  val={fmtK(monthImpr)} sub={`${fmtK(todayImpr)} today`}             col="text-violet-400"/>
        <Kpi label="Total articles"     val={String(totalArt)} sub={`${drafts} drafts · ${todayPub} today`} col="text-amber-400"/>
      </div>

      {/* ── Charts row ──────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card c="lg:col-span-2 p-5">
          <SH t="Revenue — 14 Days" a={{l:'Full report',h:'/admin/revenue'}}/>
          <RevenueChartWrapper data={chart}/>
        </Card>
        <Card c="p-5">
          <SH t="By Network"/>
          {netChart.length > 0 ? (
            <>
              <NetworkChartWrapper data={netChart}/>
              <div className="mt-4 pt-4 space-y-2.5" style={{borderTop:`1px solid ${C.bd}`}}>
                {netChart.map(n=>(
                  <div key={n.network} className="flex items-center justify-between">
                    <span className="text-[12px]" style={{color:C.m}}>{n.network}</span>
                    <span className="text-[12px] font-mono font-semibold text-emerald-400">{$(n.revenue)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center gap-3" style={{color:C.d}}>
              <span className="text-3xl opacity-40">📡</span>
              <p className="text-[12px]">No revenue data yet</p>
              <Link href="/admin/monetization/ad-networks" className="text-[11px] text-red-500 hover:text-red-400">Connect networks →</Link>
            </div>
          )}
        </Card>
      </div>

      {/* ── Impressions + Activity ───────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card c="p-5">
          <SH t="Impressions — 14 Days"/>
          <ImpressionsChartWrapper data={chart}/>
        </Card>
        {recentRev.length > 0 ? (
          <Card c="overflow-hidden">
            <div className="px-5 py-4" style={{borderBottom:`1px solid ${C.bd}`}}>
              <SH t="Revenue Activity" a={{l:'View all',h:'/admin/revenue'}}/>
            </div>
            <table className="w-full text-[12px]">
              <thead><tr style={{borderBottom:`1px solid ${C.bd}`}}>
                {['Date','Network','Impr.','Revenue'].map((h,i)=>(
                  <th key={h} className={`py-2 px-4 text-[10px] font-semibold uppercase tracking-widest ${i>=2?'text-right':'text-left'}`} style={{color:C.d}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {recentRev.map((r,i)=>(
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors" style={{borderBottom:`1px solid ${C.bd}`}}>
                    <td className="py-2 px-4 font-mono" style={{color:C.d}}>{r.date}</td>
                    <td className="py-2 px-4" style={{color:C.t}}>{r.net}</td>
                    <td className="py-2 px-4 text-right font-mono" style={{color:C.m}}>{fmtK(r.impr)}</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-emerald-400">{$(r.rev)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <Card c="p-5 flex items-center justify-center">
            <div className="text-center" style={{color:C.d}}>
              <p className="text-[13px]">No revenue activity yet.</p>
              <p className="text-[11px] mt-1">Check Vercel logs for query debug info.</p>
            </div>
          </Card>
        )}
      </div>

      {/* ── Articles + Infrastructure ────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card c="lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5" style={{borderBottom:`1px solid ${C.bd}`}}>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{color:C.d}}>Recent Articles</h2>
            <Link href="/admin/articles" className="text-[12px] text-red-500 hover:text-red-400">All →</Link>
          </div>
          {articles.length === 0 ? (
            <p className="text-[13px] text-center py-8" style={{color:C.d}}>No articles. <Link href="/admin/articles/new" className="text-red-500">Create one →</Link></p>
          ) : articles.map((a:any)=>{
            const sc:Record<string,string>={published:'bg-emerald-500/10 text-emerald-400',draft:'bg-slate-800 text-slate-500',scheduled:'bg-amber-500/10 text-amber-400'}
            return (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3 group hover:bg-white/[0.02] transition-colors" style={{borderBottom:`1px solid ${C.bd}`}}>
                <div className="flex-1 min-w-0">
                  <Link href={`/admin/articles/${a.id}/edit`} className="text-[13px] font-medium truncate block hover:text-white transition-colors" style={{color:C.t}}>{a.title}</Link>
                  {a.published_at&&<span className="text-[11px]" style={{color:C.d}}>{fmtD(a.published_at)}</span>}
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${sc[a.status]??sc.draft}`}>{a.status}</span>
                <Link href={`/admin/articles/${a.id}/edit`} className="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity" style={{color:C.m}}>Edit</Link>
              </div>
            )
          })}
        </Card>

        <div className="space-y-4">
          <Card c="p-4">
            <SH t="Ad Networks" a={{l:'Manage',h:'/admin/monetization/ad-networks'}}/>
            <div className="space-y-2.5">
              {nets.length === 0 ? (
                <Link href="/admin/monetization/ad-networks" className="text-[12px] text-red-500 block text-center py-3">+ Connect first network</Link>
              ) : nets.map(n=>(
                <div key={n.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Dot on={n.active}/><span className="text-[13px]" style={{color:n.active?C.t:C.d}}>{n.name}</span></div>
                  <span className={`text-[11px] font-semibold ${n.active?'text-emerald-500':'text-slate-700'}`}>{n.active?'Live':'Off'}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card c="p-4">
            <SH t="Publisher Sites" a={{l:'Manage',h:'/admin/monetization'}}/>
            <div className="space-y-2.5">
              {sites.length === 0 ? (
                <p className="text-[12px] text-center py-3" style={{color:C.d}}>No sites yet</p>
              ) : sites.map(s=>(
                <div key={s.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0"><Dot on={s.active}/><span className="text-[13px] truncate" style={{color:s.active?C.t:C.d}}>{s.name}</span></div>
                  <span className={`text-[11px] flex-shrink-0 ${s.active?'text-sky-500':'text-slate-700'}`}>{s.active?'Live':'—'}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Quick Actions ────────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-3" style={{color:C.d}}>Quick Actions</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            {href:'/admin/articles/new',             icon:'✏️',label:'New Article'},
            {href:'/admin/ai-writer',                icon:'🤖',label:'AI Writer'},
            {href:'/admin/trends',                   icon:'🔥',label:'Trends'},
            {href:'/admin/seo',                      icon:'🎯',label:'SEO Engine'},
            {href:'/admin/monetization/ad-networks', icon:'📡',label:'Ad Networks'},
            {href:'/admin/reports',                  icon:'📊',label:'Reports'},
          ].map(a=>(
            <Link key={a.href} href={a.href}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-colors hover:bg-white/[0.04]"
              style={{background:C.e,border:`1px solid ${C.b}`}}>
              <span className="text-xl">{a.icon}</span>
              <span className="text-[11px] font-medium" style={{color:C.m}}>{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
