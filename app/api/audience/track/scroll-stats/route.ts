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
  const days    = parseInt(searchParams.get('days') || '7')
  const since   = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Paginate through ALL scroll events — no 1000 row limit
  const allEvents: { scroll_depth: number; site_url: string; page_url: string; created_at: string }[] = []
  let page = 0
  while (true) {
    let q = admin.from('scroll_events')
      .select('scroll_depth, site_url, page_url, created_at')
      .gte('created_at', since)
      .range(page * 1000, (page + 1) * 1000 - 1)
    if (siteUrl) q = q.ilike('site_url', `%${siteUrl}%`)
    const { data: batch } = await q
    if (!batch || batch.length === 0) break
    allEvents.push(...batch)
    if (batch.length < 1000) break
    page++
    if (page > 50) break // safety cap at 50k events
  }

  if (!allEvents.length) {
    return NextResponse.json({
      buckets: [
        { label: '0-25%',   min: 0,  max: 25,  count: 0, percentage: 0 },
        { label: '25-50%',  min: 25, max: 50,  count: 0, percentage: 0 },
        { label: '50-75%',  min: 50, max: 75,  count: 0, percentage: 0 },
        { label: '75-90%',  min: 75, max: 90,  count: 0, percentage: 0 },
        { label: '90-100%', min: 90, max: 100, count: 0, percentage: 0 },
      ],
      avg_depth: 0,
      total_sessions: 0,
      by_page: [],
    })
  }

  // Scroll depth buckets
  const buckets = [
    { label: '0-25%',   min: 0,  max: 25,  count: 0 },
    { label: '25-50%',  min: 25, max: 50,  count: 0 },
    { label: '50-75%',  min: 50, max: 75,  count: 0 },
    { label: '75-90%',  min: 75, max: 90,  count: 0 },
    { label: '90-100%', min: 90, max: 100, count: 0 },
  ]

  let totalDepth = 0
  for (const e of allEvents) {
    totalDepth += e.scroll_depth
    for (const b of buckets) {
      if (e.scroll_depth >= b.min && (b.max === 100 ? e.scroll_depth <= 100 : e.scroll_depth < b.max)) {
        b.count++; break
      }
    }
  }

  const avg_depth = Math.round(totalDepth / allEvents.length)

  // By page breakdown
  const pageMap: Record<string, { depths: number[]; count: number }> = {}
  for (const e of allEvents) {
    const p = e.page_url || e.site_url || 'unknown'
    if (!pageMap[p]) pageMap[p] = { depths: [], count: 0 }
    pageMap[p].depths.push(e.scroll_depth)
    pageMap[p].count++
  }

  const by_page = Object.entries(pageMap)
    .map(([p, d]) => ({
      page: p,
      sessions: d.count,
      avg_depth: Math.round(d.depths.reduce((a, b) => a + b, 0) / d.depths.length),
      max_depth: Math.max(...d.depths),
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 20)

  return NextResponse.json({
    buckets: buckets.map(b => ({
      ...b,
      percentage: Math.round((b.count / allEvents.length) * 100),
    })),
    avg_depth,
    total_sessions: allEvents.length,
    by_page,
  })
}
