import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const isAdmin = user.email === ADMIN_EMAIL
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const today = new Date().toISOString().split('T')[0]

  const [
    { count: totalArticles },
    { count: publishedArticles },
    { count: draftArticles },
    { count: aiArticles },
    { count: articlesToday },
    { count: articlesThisWeek },
    { count: humanPublished },
    { count: cronPublished },
    { data: recentArticles },
    { data: profile },
    { data: articlesByDay },
    { data: allArticles },
  ] = await Promise.all([
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'published'),
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'draft'),
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('ai_generated', true),
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', today),
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', sevenDaysAgo),
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'published').eq('source', 'human'),
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'published').eq('source', 'cron'),
    supabase.from('articles').select('id,title,status,view_count,seo_score,published_at,ai_generated,created_at,source').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('user_profiles').select('plan,articles_used_today').eq('id', user.id).single(),
    // Include source column for accurate chart split
    supabase.from('articles').select('created_at,source').eq('user_id', user.id).gte('created_at', thirtyDaysAgo).order('created_at', { ascending: true }),
    supabase.from('articles').select('id,title,status,view_count,seo_score,published_at,ai_generated,created_at,slug,source').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
  ])

  // Cron logs — admin sees all, publishers see only their own
  const cronQuery = admin
    .from('cron_logs')
    .select('*')
    .order('ran_at', { ascending: false })
    .limit(15)

  const { data: cronLogs } = isAdmin
    ? await cronQuery
    : await cronQuery.eq('user_id', user.id)

  // Build chart data — split by source column
  const dayMap: Record<string, { human: number; cron: number }> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().split('T')[0]
    dayMap[key] = { human: 0, cron: 0 }
  }
  for (const a of articlesByDay || []) {
    const key = a.created_at.split('T')[0]
    if (dayMap[key] !== undefined) {
      if (a.source === 'cron') dayMap[key].cron++
      else dayMap[key].human++
    }
  }
  const chartData = Object.entries(dayMap).map(([date, counts]) => ({
    date,
    count: counts.human + counts.cron,
    human: counts.human,
    cron: counts.cron,
  }))

  const cronSuccess = (cronLogs || []).filter(l => l.status === 'success').length
  const cronFailed  = (cronLogs || []).filter(l => l.status === 'failed').length
  const cronSkipped = (cronLogs || []).filter(l => l.status === 'skipped').length

  return NextResponse.json({
    stats: {
      totalArticles:     totalArticles     || 0,
      publishedArticles: publishedArticles || 0,
      draftArticles:     draftArticles     || 0,
      aiArticles:        aiArticles        || 0,
      articlesToday:     articlesToday     || 0,
      articlesThisWeek:  articlesThisWeek  || 0,
      humanPublished:    humanPublished    || 0,
      cronPublished:     cronPublished     || 0,
    },
    chartData,
    recentArticles: recentArticles || [],
    allArticles:    allArticles    || [],
    cronLogs:       cronLogs       || [],
    cronStats: { success: cronSuccess, failed: cronFailed, skipped: cronSkipped },
    plan: profile?.plan || 'free',
    articlesUsedToday: profile?.articles_used_today || 0,
    planLimit: ['pro', 'popular', 'byoak', 'agency', 'growth'].includes(profile?.plan || '') ? 999 : 5,
    isAdmin,
  })
}
