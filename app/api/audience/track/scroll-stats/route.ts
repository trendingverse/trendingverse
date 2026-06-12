// app/api/audience/track/scroll-stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { searchParams } = new URL(req.url)
  const siteUrl = searchParams.get('site_url')
  const days = parseInt(searchParams.get('days') || '7')
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  let query = admin
    .from('scroll_events')
    .select('scroll_depth, site_url, page_url, created_at')
    .gte('created_at', since)
    .limit(10000)

  if (siteUrl) query = query.ilike('site_url', `%${siteUrl}%`)

  const { data: events } = await query

  if (!events?.length) {
    return NextResponse.json({ buckets: [], avg_depth: 0, total_sessions: 0, by_page: [] })
  }

  // Scroll depth buckets
  const buckets = [
    { label: '0-25%',  min: 0,  max: 25,  count: 0 },
    { label: '25-50%', min: 25, max: 50,  count: 0 },
    { label: '50-75%', min: 50, max: 75,  count: 0 },
    { label: '75-90%', min: 75, max: 90,  count: 0 },
    { label: '90-100%',min: 90, max: 100, count: 0 },
  ]

  let totalDepth = 0
  for (const e of events) {
    totalDepth += e.scroll_depth
    for (const b of buckets) {
      if (e.scroll_depth >= b.min && e.scroll_depth < b.max + (b.max === 100 ? 1 : 0)) {
        b.count++; break
      }
    }
  }

  const avg_depth = Math.round(totalDepth / events.length)

  // By page breakdown
  const pageMap: Record<string, { depths: number[]; count: number }> = {}
  for (const e of events) {
    const page = e.page_url || e.site_url || 'unknown'
    if (!pageMap[page]) pageMap[page] = { depths: [], count: 0 }
    pageMap[page].depths.push(e.scroll_depth)
    pageMap[page].count++
  }

  const by_page = Object.entries(pageMap)
    .map(([page, d]) => ({
      page,
      sessions: d.count,
      avg_depth: Math.round(d.depths.reduce((a, b) => a + b, 0) / d.depths.length),
      max_depth: Math.max(...d.depths),
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 20)

  return NextResponse.json({
    buckets: buckets.map(b => ({ ...b, percentage: Math.round((b.count / events.length) * 100) })),
    avg_depth,
    total_sessions: events.length,
    by_page,
  })
}
