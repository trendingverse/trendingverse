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

  const siteCondition = siteFilter
    ? (q: any) => q.eq('source_site', siteFilter)
    : (q: any) => q

  const [
    { count: totalProfiles },
    { count: totalLeads },
    { count: mobileUsers },
    { count: desktopUsers },
    { data: citiesRaw },
    { data: interestsRaw },
    { data: deviceBreakdown },
    { data: genderBreakdown },
    { data: ageBreakdown },
    { data: recentLeads },
    { data: dailyEvents },
    { data: topSitesRaw },
  ] = await Promise.all([
    // Total profiles
    siteCondition(admin.from('audience_profiles').select('*', { count: 'exact', head: true })),
    // Leads = profiles with email — from audience_profiles not audience_leads
    siteCondition(admin.from('audience_profiles').select('*', { count: 'exact', head: true }))
      .not('email', 'is', null).not('email', 'eq', ''),
    // Mobile
    siteCondition(admin.from('audience_profiles').select('*', { count: 'exact', head: true })).eq('device_type', 'mobile'),
    // Desktop
    siteCondition(admin.from('audience_profiles').select('*', { count: 'exact', head: true })).eq('device_type', 'desktop'),
    // Cities
    siteCondition(admin.from('audience_profiles').select('city')).not('city', 'is', null).not('city', 'eq', ''),
    // Interests
    siteCondition(admin.from('audience_profiles').select('interests')).not('interests', 'is', null),
    // Device
    siteCondition(admin.from('audience_profiles').select('device_type')).not('device_type', 'is', null),
    // Gender
    siteCondition(admin.from('audience_profiles').select('gender')).not('gender', 'is', null),
    // Age
    siteCondition(admin.from('audience_profiles').select('age_range')).not('age_range', 'is', null),
    // Recent leads — from audience_profiles with email
    siteCondition(
      admin.from('audience_profiles')
        .select('email, city, country, source_site, created_at')
        .not('email', 'is', null)
        .not('email', 'eq', '')
    ).order('created_at', { ascending: false }).limit(50),
    // Daily pageviews
    siteCondition(
      admin.from('audience_events')
        .select('created_at, event_type')
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
    ).eq('event_type', 'pageview'),
    // Top sites
    admin.from('audience_events').select('site_url').eq('event_type', 'pageview'),
  ])

  // Aggregate cities
  const cityMap: Record<string, number> = {}
  for (const r of citiesRaw || []) {
    if (r.city) cityMap[r.city] = (cityMap[r.city] || 0) + 1
  }
  const topCities = Object.entries(cityMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([city, count]) => ({ city, count }))

  // Aggregate interests
  const interestMap: Record<string, number> = {}
  for (const r of interestsRaw || []) {
    for (const interest of (r.interests as string[]) || []) {
      if (interest) interestMap[interest] = (interestMap[interest] || 0) + 1
    }
  }
  const topInterests = Object.entries(interestMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([interest, count]) => ({ interest, count }))

  // Device breakdown
  const deviceMap: Record<string, number> = {}
  for (const r of deviceBreakdown || []) {
    if (r.device_type) deviceMap[r.device_type] = (deviceMap[r.device_type] || 0) + 1
  }

  // Gender breakdown
  const genderMap: Record<string, number> = {}
  for (const r of genderBreakdown || []) {
    if (r.gender) genderMap[r.gender] = (genderMap[r.gender] || 0) + 1
  }

  // Age breakdown
  const ageMap: Record<string, number> = {}
  for (const r of ageBreakdown || []) {
    if (r.age_range) ageMap[r.age_range] = (ageMap[r.age_range] || 0) + 1
  }

  // Daily chart
  const dayMap: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    dayMap[new Date(Date.now() - i * 86400000).toISOString().split('T')[0]] = 0
  }
  for (const e of dailyEvents || []) {
    const key = e.created_at.split('T')[0]
    if (dayMap[key] !== undefined) dayMap[key]++
  }

  // Top sites
  const siteMap: Record<string, number> = {}
  for (const e of topSitesRaw || []) {
    if (e.site_url) siteMap[e.site_url] = (siteMap[e.site_url] || 0) + 1
  }
  const topSites = Object.entries(siteMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([site, views]) => ({ site, views }))

  return NextResponse.json({
    totals: {
      profiles: totalProfiles || 0,
      leads: totalLeads || 0,
      mobile: mobileUsers || 0,
      desktop: desktopUsers || 0,
    },
    deviceBreakdown: deviceMap,
    genderBreakdown: genderMap,
    ageBreakdown: ageMap,
    topCities,
    topInterests,
    topSites,
    recentLeads: (recentLeads || []).map((l: any) => ({
      email: l.email,
      name: l.name || '',
      city: l.city || '',
      gender: l.gender || '',
      age_range: l.age_range || '',
      source_site: l.source_site || '',
      created_at: l.created_at,
    })),
    chartData: Object.entries(dayMap).map(([date, views]) => ({ date, views })),
  })
}
