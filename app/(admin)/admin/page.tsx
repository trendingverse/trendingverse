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

/* ─── Formatters ─────────────────────────────────────────────────── */
const $    = (n: number) => n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`
const fmtK = (n: number) => n >= 1_000_000 ? `${(n/1e6).toFixed(1)}M` : n >= 1_000 ? `${(n/1e3).toFixed(1)}k` : String(n)
const fmtD = (iso: string) => { try { return new Date(iso).toLocaleDateString('en-IN',{month:'short',day:'numeric'}) } catch { return iso } }

/* ─── Tokens ─────────────────────────────────────────────────────── */
const C = { s:'#0e1726',e:'#131f33',b:'#1a2840',bd:'#111e30',t:'#dde4f0',m:'#6b82a8',d:'#2d3f58' }

/* ─── UI atoms ───────────────────────────────────────────────────── */
function Card({ c='', children }: { c?:string; children:React.ReactNode }) {
  return <div className={`rounded-xl ${c}`} style={{background:C.s,border:`1px solid ${C.b}`}}>{children}</div>
}
function Kpi({ label,val,sub,col }:{ label:string;val:string;sub?:string;col:string }) {
  return <Card><div className="p-5"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{color:C.d}}>{label}</p><p className={`text-[28px] font-mono font-bold leading-none ${col}`}>{val}</p>{sub&&<p className="text-[12px] mt-1.5" style={{color:C.m}}>{sub}</p>}</div></Card>
}
function SH({ t,a }:{ t:string;a?:{l:string;h:string} }) {
  return <div className="flex items-center justify-between mb-4"><h2 className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{color:C.d}}>{t}</h2>{a&&<Link href={a.h} className="text-[12px] font-medium text-red-500 hover:text-red-400">{a.l} →</Link>}</div>
}
function Dot({ on }:{ on:boolean }) { return <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${on?'bg-emerald-500':'bg-slate-700'}`}/> }

/* ─── Safe query ──────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sq(fn:()=>any): Promise<any[]> {
  try { const r=await fn(); if(r?.error){console.error('[sq]',r.error.code,r.error.message);return[]} return Array.isArray(r?.data)?r.data:[] } catch(e){console.error('[sq threw]',e);return[]}
}
async function sqN(fn:()=>any): Promise<number> {
  try { const r=await fn(); if(r?.error){console.error('[sqN]',r.error.message);return 0} return r?.count??0 } catch{return 0}
}

/* ─── Normalise partner_revenue row ─────────────────────────────────
   CONFIRMED column names from debug page:
   id, partner_id, partner_slug, site_url, revenue_date,
   impressions, clicks, revenue_usd, revenue_inr, currency, raw, synced_at
   ──────────────────────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normRev(r:any) {
  return {
    date: (r.revenue_date ?? r.date ?? r.created_at ?? '').slice(0,10),
    rev:  +(r.revenue_usd  ?? r.revenue   ?? 0),
    impr: +(r.impressions  ?? 0),
    net:   r.partner_slug  ?? r.partner_name ?? r.network_name ?? 'Unknown',
    site:  r.site_url      ?? '',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normNet(r:any) {
  return {
    id:      r.id           ?? '',
    name:    r.name         ?? r.partner_slug ?? r.slug ?? r.label ?? 'Network',
    active: !!(r.is_active  ?? r.active ?? r.enabled ?? true),
    priority:+(r.priority   ?? r.waterfall_order ?? r.order ?? 0),
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normSite(r:any) {
  return {
    id:    r.id   ?? '',
    name:  r.name ?? r.site_name ?? r.site_url ?? '',
    active:!!(r.is_active ?? r.active ?? true),
  }
}

/* ─── Page ───────────────────────────────────────────────────────── */
export default async function AdminDashboard() {
  const supabase = await createClient()
  const svc = svcClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now      = new Date()
  const todayISO = now.toISOString().slice(0,10)

  // Use 180 days so older data (June 2026) is always included
  const d7   = new Date(now); d7.setDate(now.getDate()-7)
  const d30  = new Date(now); d30.setDate(now.getDate()-30)
  const d180 = new Date(now); d180.setDate(now.getDate()-180)
  const d180str = d180.toISOString().slice(0,10)

  /* ── Parallel queries ──────────────────────────────────────────── */
  const [
    totalArt, drafts, todayPub,
    rawRev, rawRecent,
    rawArticles, rawNets, rawSites, rawPartners,
  ] = await Promise.all([
    sqN(()=>supabase.from('articles').select('*',{count:'exact',head:true})),
    sqN(()=>supabase.from('articles').select('*',{count:'exact',head:true}).eq('status','draft')),
    sqN(()=>supabase.from('articles').select('*',{count:'exact',head:true}).eq('status','published').gte('published_at',todayISO+'T00:00:00Z')),

    // ✅ FIXED: filter on revenue_date (not date), range 180 days
    sq(()=>svc.from('partner_revenue').select('*').gte('revenue_date',d180str).order('revenue_date',{ascending:true}).limit(1000)),

    // Recent revenue rows for activity table
    sq(()=>svc.from('partner_revenue').select('*').order('revenue_date',{ascending:false}).limit(10)),

    sq(()=>supabase.from('articles').select('id,title,status,published_at').order('created_at',{ascending:false}).limit(10)),
    sq(()=>svc.from('ad_networks').select('*').order('priority',{ascending:true})),
    sq(()=>svc.from('partners').select('*').order('created_at',{ascending:true}).limit(20)),
    sq(()=>svc.from('sites').select('*').limit(6)),
  ])

  /* ── Normalise ─────────────────────────────────────────────────── */
  const rows      = rawRev.map(normRev)
  const recentRev = rawRecent.map(normRev)
  // ad_networks = actual ad networks (Adsterra, HilltopAds etc.)
  const nets  = rawNets.map(normNet)
  // partners table confirmed to hold publisher sites
  // partners table = publisher sites (Karunadasuddi, TrendingVerse, Kannada Dunia, Nitya Soubhagya)
  const sites = (rawPartners.length > 0 ? rawPartners : rawSites).map(normSite)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const articles  = rawArticles as any[]

  /* ── Aggregations ───────────────────────────────────────────────── */
  const todayRows = rows.filter(r=>r.date===todayISO)
  const weekRows  = rows.filter(r=>r.date>=d7.toISOString().slice(0,10))
  const month30   = rows.filter(r=>r.date>=d30.toISOString().slice(0,10))

  const todayRev  = todayRows.reduce((s,r)=>s+r.rev,0)
  const weekRev   = weekRows.reduce((s,r)=>s+r.rev,0)
  const monthRev  = month30.reduce((s,r)=>s+r.rev,0)
  const allRev    = rows.reduce((s,r)=>s+r.rev,0)
  const monthImpr = month30.reduce((s,r)=>s+r.impr,0)
  const todayImpr = todayRows.reduce((s,r)=>s+r.impr,0)
  const allImpr   = rows.reduce((s,r)=>s+r.impr,0)
  const cpm       = allImpr>0 ? (allRev/allImpr)*1000 : 0

  /* ── Find date range of actual data ─────────────────────────────── */
  const firstDate = rows.length>0 ? rows[0].date : null
  const lastDate  = rows.length>0 ? rows[rows.length-1].date : null

  /* ── Build chart using actual date range (last 60 days or all data) ─ */
  // Use 60-day window so chart shows meaningful data
  const d60 = new Date(now); d60.setDate(now.getDate()-59)
  const chartStart = firstDate && firstDate < d60.toISOString().slice(0,10)
    ? d60.toISOString().slice(0,10)
    : (firstDate ?? todayISO)

  const chartDays: string[] = []
  const cur = new Date(chartStart)
  while (cur <= now && chartDays.length < 60) {
    chartDays.push(cur.toISOString().slice(0,10))
    cur.setDate(cur.getDate()+1)
  }

  const chart = chartDays.map(date=>({
    date:        date.slice(5),
    revenue:     rows.filter(r=>r.date===date).reduce((s,r)=>s+r.rev,0),
    impressions: rows.filter(r=>r.date===date).reduce((s,r)=>s+r.impr,0),
  }))

  /* ── Network breakdown ──────────────────────────────────────────── */
  const nm:Record<string,number>={}
  rows.forEach(r=>{nm[r.net]=(nm[r.net]??0)+r.rev})
  const netChart=Object.entries(nm).map(([network,revenue])=>({network,revenue})).sort((a,b)=>b.revenue-a.revenue)

  const dateRange = firstDate && lastDate
    ? ` (${fmtD(firstDate)} – ${fmtD(lastDate)})`
    : ''

  /* ─────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6 pb-8" style={{color:C.t}}>

      {/* Header */}
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

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Revenue today"      val={$(todayRev)}    sub={`${$(weekRev)} this week`}           col="text-emerald-400"/>
        <Kpi label="Revenue (30d)"      val={$(monthRev)}    sub={`All-time $${allRev.toFixed(2)} · CPM $${cpm.toFixed(2)}`} col="text-sky-400"/>
        <Kpi label="Impressions (30d)"  val={fmtK(monthImpr)} sub={`${fmtK(todayImpr)} today · ${fmtK(allImpr)} all-time`} col="text-violet-400"/>
        <Kpi label="Total articles"     val={String(totalArt)} sub={`${drafts} drafts · ${todayPub} today`} col="text-amber-400"/>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card c="lg:col-span-2 p-5">
          <SH t={`Revenue${dateRange}`} a={{l:'Full report',h:'/admin/revenue'}}/>
          <RevenueChartWrapper data={chart}/>
        </Card>
        <Card c="p-5">
          <SH t="By Network"/>
          {netChart.length>0 ? (
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
            </div>
          )}
        </Card>
      </div>

      {/* Impressions + Activity */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card c="p-5">
          <SH t={`Impressions${dateRange}`}/>
          <ImpressionsChartWrapper data={chart}/>
        </Card>
        {recentRev.length>0 ? (
          <Card c="overflow-hidden">
            <div className="px-5 py-4" style={{borderBottom:`1px solid ${C.bd}`}}>
              <SH t="Revenue Activity" a={{l:'View all',h:'/admin/revenue'}}/>
            </div>
            <table className="w-full text-[12px]">
              <thead><tr style={{borderBottom:`1px solid ${C.bd}`}}>
                {['Date','Network','Site','Impr.','Revenue'].map((h,i)=>(
                  <th key={h} className={`py-2 px-3 text-[10px] font-semibold uppercase tracking-widest ${i>=3?'text-right':'text-left'}`} style={{color:C.d}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {recentRev.map((r,i)=>(
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors" style={{borderBottom:`1px solid ${C.bd}`}}>
                    <td className="py-2 px-3 font-mono" style={{color:C.d}}>{r.date}</td>
                    <td className="py-2 px-3" style={{color:C.t}}>{r.net}</td>
                    <td className="py-2 px-3 text-[11px] truncate max-w-[100px]" style={{color:C.m}}>{r.site}</td>
                    <td className="py-2 px-3 text-right font-mono" style={{color:C.m}}>{fmtK(r.impr)}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-400">{$(r.rev)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <Card c="p-5 flex items-center justify-center">
            <p className="text-[13px] text-center" style={{color:C.d}}>No revenue activity in range.</p>
          </Card>
        )}
      </div>

      {/* Articles + Infrastructure */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card c="lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5" style={{borderBottom:`1px solid ${C.bd}`}}>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{color:C.d}}>Recent Articles</h2>
            <Link href="/admin/articles" className="text-[12px] text-red-500 hover:text-red-400">All →</Link>
          </div>
          {articles.length===0 ? (
            <p className="text-[13px] text-center py-8" style={{color:C.d}}>No articles yet. <Link href="/admin/articles/new" className="text-red-500">Create one →</Link></p>
          ) : articles.map((a:{ id:string;title:string;status:string;published_at?:string|null })=>{
            const sc:Record<string,string>={published:'bg-emerald-500/10 text-emerald-400',draft:'bg-slate-800 text-slate-500',scheduled:'bg-amber-500/10 text-amber-400'}
            return(
              <div key={a.id} className="flex items-center gap-3 px-5 py-3 group hover:bg-white/[0.02] transition-colors" style={{borderBottom:`1px solid ${C.bd}`}}>
                <div className="flex-1 min-w-0">
                  <Link href={`/admin/articles/${a.id}/edit`} className="text-[13px] font-medium truncate block hover:text-white" style={{color:C.t}}>{a.title}</Link>
                  {a.published_at&&<span className="text-[11px]" style={{color:C.d}}>{fmtD(a.published_at)}</span>}
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${sc[a.status]??sc.draft}`}>{a.status}</span>
                <Link href={`/admin/articles/${a.id}/edit`} className="text-[11px] opacity-0 group-hover:opacity-100" style={{color:C.m}}>Edit</Link>
              </div>
            )
          })}
        </Card>

        <div className="space-y-4">
          <Card c="p-4">
            <SH t="Ad Networks" a={{l:'Manage',h:'/admin/monetization/ad-networks'}}/>
            <div className="space-y-2.5">
              {nets.length===0?(
                <Link href="/admin/monetization/ad-networks" className="text-[12px] text-red-500 block text-center py-3">+ Connect first network</Link>
              ):nets.map(n=>(
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
              {sites.length===0?(
                <p className="text-[12px] text-center py-3" style={{color:C.d}}>No sites yet</p>
              ):sites.map(s=>(
                <div key={s.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0"><Dot on={s.active}/><span className="text-[13px] truncate" style={{color:s.active?C.t:C.d}}>{s.name}</span></div>
                  <span className={`text-[11px] flex-shrink-0 ${s.active?'text-sky-500':'text-slate-700'}`}>{s.active?'Live':'—'}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
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
            <Link key={a.href} href={a.href} className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-center hover:bg-white/[0.04] transition-colors" style={{background:C.e,border:`1px solid ${C.b}`}}>
              <span className="text-xl">{a.icon}</span>
              <span className="text-[11px] font-medium" style={{color:C.m}}>{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
