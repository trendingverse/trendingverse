import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const today = new Date().toISOString().split('T')[0]

  // All queries filtered by user.id for proper isolation
  const [
    { count: totalArticles },
    { count: publishedArticles },
    { count: draftArticles },
    { count: aiArticles },
    { count: articlesToday },
    { count: articlesThisWeek },
    { data: recentArticles },
    { data: cronLogs },
    { data: profile },
    { data: articlesByDay },
  ] = await Promise.all([
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'published'),
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'draft'),
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('ai_generated', true),
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', today),
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', sevenDaysAgo),
    supabase.from('articles').select('id,title,status,view_count,seo_score,published_at,ai_generated').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('cron_logs').select('*').eq('user_id', user.id).order('ran_at', { ascending: false }).limit(10),
    supabase.from('user_profiles').select('plan,articles_used_today,subscription_status').eq('id', user.id).single(),
    supabase.from('articles').select('created_at').eq('user_id', user.id).gte('created_at', thirtyDaysAgo).order('created_at', { ascending: true }),
  ])

  // Build chart data
  const dayMap: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().split('T')[0]
    dayMap[key] = 0
  }
  for (const a of articlesByDay || []) {
    const key = a.created_at.split('T')[0]
    if (dayMap[key] !== undefined) dayMap[key]++
  }
  const chartData = Object.entries(dayMap).map(([date, count]) => ({ date, count }))

  const cronSuccess = (cronLogs || []).filter(l => l.status === 'success').length
  const cronFailed = (cronLogs || []).filter(l => l.status === 'failed').length
  const cronSkipped = (cronLogs || []).filter(l => l.status === 'skipped').length

  return NextResponse.json({
    stats: {
      totalArticles: totalArticles || 0,
      publishedArticles: publishedArticles || 0,
      draftArticles: draftArticles || 0,
      aiArticles: aiArticles || 0,
      articlesToday: articlesToday || 0,
      articlesThisWeek: articlesThisWeek || 0,
    },
    chartData,
    recentArticles: recentArticles || [],
    cronLogs: cronLogs || [],
    cronStats: { success: cronSuccess, failed: cronFailed, skipped: cronSkipped },
    plan: profile?.plan || 'free',
    articlesUsedToday: profile?.articles_used_today || 0,
    planLimit: profile?.plan === 'pro' || profile?.plan === 'popular' || profile?.plan === 'byoak' ? 999 : 5,
  })
}
