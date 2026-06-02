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
    { data: topSites },
  ] = await Promise.all([
    admin.from('audience_profiles').select('*', { count: 'exact', head: true }),
    admin.from('audience_leads').select('*', { count: 'exact', head: true }),
    admin.from('audience_profiles').select('*', { count: 'exact', head: true }).eq('device_type', 'mobile'),
    admin.from('audience_profiles').select('*', { count: 'exact', head: true }).eq('device_type', 'desktop'),

  // Top cities — raw query instead of RPC
admin.from('audience_profiles').select('city').not('city', 'is', null).not('city', 'eq', ''),

// Top interests — raw query
admin.from('audience_profiles').select('interests').not('interests', 'is', null),

    // Device breakdown
    admin.from('audience_profiles').select('device_type').not('device_type', 'is', null),

    // Gender breakdown
    admin.from('audience_profiles').select('gender').not('gender', 'is', null),

    // Age breakdown
    admin.from('audience_profiles').select('age_range').not('age_range', 'is', null),

    // Recent leads
    admin.from('audience_leads')
      .select('email, name, city, gender, age_range, source_site, created_at')
      .order('created_at', { ascending: false })
      .limit(20),

    // Daily events last 30 days
    admin.from('audience_events')
      .select('created_at, event_type')
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
      .eq('event_type', 'pageview'),

    // Top publisher sites
    admin.from('audience_events')
      .select('site_url')
      .eq('event_type', 'pageview'),
  ])

  // Build aggregations from raw data
  const deviceMap: Record<string, number> = {}
  for (const r of deviceBreakdown || []) {
    if (r.device_type) deviceMap[r.device_type] = (deviceMap[r.device_type] || 0) + 1
  }

  const genderMap: Record<string, number> = {}
  for (const r of genderBreakdown || []) {
    if (r.gender) genderMap[r.gender] = (genderMap[r.gender] || 0) + 1
  }

  const ageMap: Record<string, number> = {}
  for (const r of ageBreakdown || []) {
    if (r.age_range) ageMap[r.age_range] = (ageMap[r.age_range] || 0) + 1
  }

  // Daily pageviews chart
  const dayMap: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
    dayMap[d] = 0
  }
  for (const e of dailyEvents || []) {
    const key = e.created_at.split('T')[0]
    if (dayMap[key] !== undefined) dayMap[key]++
  }

  // Top sites
  const siteMap: Record<string, number> = {}
  for (const e of topSites || []) {
    if (e.site_url) siteMap[e.site_url] = (siteMap[e.site_url] || 0) + 1
  }
  const topSitesList = Object.entries(siteMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
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
    topSites: topSitesList,
    recentLeads: recentLeads || [],
    chartData: Object.entries(dayMap).map(([date, views]) => ({ date, views })),
  })
}
