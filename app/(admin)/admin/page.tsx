import { createClient } from '@/lib/supabase/server'
import { DashboardStats } from '@/components/admin/DashboardStats'
import { RecentArticles } from '@/components/admin/RecentArticles'
import { ViewsChart } from '@/components/admin/ViewsChart'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0)
  const weekStart = new Date(now); weekStart.setDate(now.getDate()-7)

  const [
    { count: total },
    { count: published },
    { count: draft },
    { count: viewsToday },
    { count: viewsWeek },
    { data: recent },
    { count: subscribers },
    { data: topCats },
  ] = await Promise.all([
    supabase.from('articles').select('*',{count:'exact',head:true}),
    supabase.from('articles').select('*',{count:'exact',head:true}).eq('status','published'),
    supabase.from('articles').select('*',{count:'exact',head:true}).eq('status','draft'),
    supabase.from('article_views').select('*',{count:'exact',head:true}).gte('viewed_at',todayStart.toISOString()),
    supabase.from('article_views').select('*',{count:'exact',head:true}).gte('viewed_at',weekStart.toISOString()),
    supabase.from('articles').select('id,title,status,view_count,created_at,category_name,seo_score').order('created_at',{ascending:false}).limit(8),
    supabase.from('newsletter_subscribers').select('*',{count:'exact',head:true}).eq('is_active',true),
    supabase.from('categories').select('name,article_count').order('article_count',{ascending:false}).limit(5),
  ])

  const stats = {
    total_articles: total||0, published_articles: published||0, draft_articles: draft||0,
    views_today: viewsToday||0, views_week: viewsWeek||0, total_subscribers: subscribers||0,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">Dashboard</h1>
        <p className="text-sm text-ink-400 mt-0.5">Welcome to TrendingVerse CMS.</p>
      </div>
      <DashboardStats stats={stats} />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ViewsChartClient />
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-sm text-ink-700 mb-4">Top Categories</h3>
          <div className="space-y-3">
            {(topCats||[]).map((c:{name:string;article_count:number}) => (
              <div key={c.name} className="flex items-center justify-between">
                <span className="text-sm text-ink-700">{c.name}</span>
                <span className="text-sm font-semibold text-ink-950">{c.article_count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <RecentArticles articles={recent||[]} />
    </div>
  )
}

async function ViewsChartClient() {
  // Fetch from analytics API server-side
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  let chartData: {date:string;views:number}[] = []
  try {
    const res = await fetch(`${baseUrl}/api/analytics?days=14`, { next: { revalidate: 300 } })
    if (res.ok) chartData = await res.json()
  } catch {}
  return <ViewsChart data={chartData} />
}
