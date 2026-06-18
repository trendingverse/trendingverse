// app/api/audience/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { searchParams } = new URL(req.url)
  const siteFilter = searchParams.get('site')
  const dateFrom   = searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const dateTo     = searchParams.get('to')   || new Date().toISOString().split('T')[0]

  const siteCondition = siteFilter
    ? (q: any) => q.eq('source_site', siteFilter)
    : (q: any) => q

  // ── TOTALS ────────────────────────────────────────────────────
  const [
    { count: totalProfiles },
    { count: totalLeads },
    { count: mobileUsers },
    { count: desktopUsers },
  ] = await Promise.all([
    siteCondition(admin.from('audience_profiles').select('*', { count: 'exact', head: true })),
    siteCondition(admin.from('audience_profiles').select('*', { count: 'exact', head: true }))
      .not('email', 'is', null).not('email', 'eq', ''),
    siteCondition(admin.from('audience_profiles').select('*', { count: 'exact', head: true })).eq('device_type', 'mobile'),
    siteCondition(admin.from('audience_profiles').select('*', { count: 'exact', head: true })).eq('device_type', 'desktop'),
  ])

  // ── GEO — paginate to get ALL cities ─────────────────────────
  const cityMap: Record<string, number> = {}
  let geoPage = 0
  while (true) {
    let q = admin.from('audience_profiles')
      .select('city')
      .not('city', 'is', null)
      .not('city', 'eq', '')
      .range(geoPage * 1000, (geoPage + 1) * 1000 - 1)
    if (siteFilter) q = q.eq('source_site', siteFilter)
    const { data: batch } = await q
    if (!batch || batch.length === 0) break
    for (const r of batch) {
      if (r.city) cityMap[r.city] = (cityMap[r.city] || 0) + 1
    }
    if (batch.length < 1000) break
    geoPage++
    if (geoPage > 20) break
  }
  const topCities = Object.entries(cityMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 20)
    .map(([city, count]) => ({ city, count }))

  // ── INTERESTS ─────────────────────────────────────────────────
  const { data: interestsRaw } = await siteCondition(
    admin.from('audience_profiles').select('interests').not('interests', 'is', null)
  ).limit(5000)
  const interestMap: Record<string, number> = {}
  for (const r of interestsRaw || []) {
    for (const interest of (r.interests as string[]) || []) {
      if (interest) interestMap[interest] = (interestMap[interest] || 0) + 1
    }
  }
  const topInterests = Object.entries(interestMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([interest, count]) => ({ interest, count }))

  // ── DEVICE / GENDER / AGE ─────────────────────────────────────
  const { data: breakdownRaw } = await siteCondition(
    admin.from('audience_profiles').select('device_type, gender, age_range')
  ).limit(10000)

  const deviceMap: Record<string, number> = {}
  const genderMap: Record<string, number> = {}
  const ageMap:    Record<string, number> = {}
  for (const r of breakdownRaw || []) {
    if (r.device_type) deviceMap[r.device_type] = (deviceMap[r.device_type] || 0) + 1
    if (r.gender)      genderMap[r.gender]       = (genderMap[r.gender]       || 0) + 1
    if (r.age_range)   ageMap[r.age_range]        = (ageMap[r.age_range]        || 0) + 1
  }

  // ── LEADS — with name, gender, age ───────────────────────────
  const { data: recentLeads } = await siteCondition(
    admin.from('audience_profiles')
      .select('email, city, country, source_site, created_at, gender, age_range')
      .not('email', 'is', null)
      .not('email', 'eq', '')
  ).order('created_at', { ascending: false }).limit(100)

  // ── DAILY PAGEVIEWS — use audience_profiles created_at ────────
  // Build day map for date range
  const dayMap: Record<string, number> = {}
  const fromDate = new Date(dateFrom)
  const toDate   = new Date(dateTo)
  for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
    dayMap[d.toISOString().split('T')[0]] = 0
  }

  // Try audience_events first
  let usedEvents = false
  const { data: eventsData, error: eventsError } = await siteCondition(
    admin.from('audience_events')
      .select('created_at')
      .eq('event_type', 'pageview')
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo + 'T23:59:59Z')
  ).limit(50000)

  if (!eventsError && eventsData && eventsData.length > 0) {
    usedEvents = true
    for (const e of eventsData) {
      const key = e.created_at.split('T')[0]
      if (dayMap[key] !== undefined) dayMap[key]++
    }
  }

  // Fallback — use audience_profiles created_at
  if (!usedEvents) {
    let profPage = 0
    while (true) {
      let q = admin.from('audience_profiles')
        .select('created_at')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59Z')
        .range(profPage * 1000, (profPage + 1) * 1000 - 1)
      if (siteFilter) q = q.eq('source_site', siteFilter)
      const { data: batch } = await q
      if (!batch || batch.length === 0) break
      for (const e of batch) {
        const key = e.created_at.split('T')[0]
        if (dayMap[key] !== undefined) dayMap[key]++
      }
      if (batch.length < 1000) break
      profPage++
      if (profPage > 50) break
    }
  }

  // ── TOP SITES ─────────────────────────────────────────────────
  const { data: sitesRaw } = await admin
    .from('audience_profiles')
    .select('source_site')
    .not('source_site', 'is', null)
    .limit(50000)
  const siteMap: Record<string, number> = {}
  for (const r of sitesRaw || []) {
    if (r.source_site) siteMap[r.source_site] = (siteMap[r.source_site] || 0) + 1
  }
  const topSites = Object.entries(siteMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([site, views]) => ({ site, views }))

  return NextResponse.json({
    totals: {
      profiles: totalProfiles || 0,
      leads:    totalLeads    || 0,
      mobile:   mobileUsers   || 0,
      desktop:  desktopUsers  || 0,
    },
    deviceBreakdown: deviceMap,
    genderBreakdown: genderMap,
    ageBreakdown:    ageMap,
    topCities,
    topInterests,
    topSites,
    recentLeads: (recentLeads || []).map((l: any) => ({
      email:       l.email        || '',
      name:        l.name         || '',
      city:        l.city         || '',
      country:     l.country      || '',
      gender:      l.gender       || '',
      age_range:   l.age_range    || '',
      source_site: l.source_site  || '',
      created_at:  l.created_at,
    })),
    chartData: Object.entries(dayMap).map(([date, views]) => ({ date, views })),
    date_range: { from: dateFrom, to: dateTo },
  })
}
