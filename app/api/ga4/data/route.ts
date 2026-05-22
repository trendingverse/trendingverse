import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

async function refreshToken(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  return res.ok ? data.access_token : null
}

async function ga4Query(accessToken: string, propertyId: string, body: Record<string, unknown>) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `GA4 API error ${res.status}`)
  }
  return res.json()
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await admin
    .from('user_profiles')
    .select('ga4_access_token, ga4_refresh_token, ga4_token_expiry, ga4_property_id, ga4_property_name')
    .eq('id', user.id)
    .single()

  if (!profile?.ga4_access_token) return NextResponse.json({ connected: false })
  if (!profile?.ga4_property_id) return NextResponse.json({ connected: true, needs_property: true })

  // Refresh if expired
  let accessToken = profile.ga4_access_token
  if (profile.ga4_token_expiry && new Date(profile.ga4_token_expiry) <= new Date()) {
    if (!profile.ga4_refresh_token) return NextResponse.json({ connected: false, error: 'Token expired' })
    const newToken = await refreshToken(profile.ga4_refresh_token)
    if (!newToken) return NextResponse.json({ connected: false, error: 'Token refresh failed' })
    accessToken = newToken
    await admin.from('user_profiles').update({
      ga4_access_token: newToken,
      ga4_token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
    }).eq('id', user.id)
  }

  const propertyId = profile.ga4_property_id
  const endDate = 'today'
  const startDate = '28daysAgo'

  try {
    const [overviewData, topPagesData, sourcesData, devicesData, dailyData] = await Promise.all([
      // Overall metrics
      ga4Query(accessToken, propertyId, {
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' },
          { name: 'bounceRate' }, { name: 'averageSessionDuration' }, { name: 'newUsers' },
        ],
      }),
      // Top pages
      ga4Query(accessToken, propertyId, {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'averageSessionDuration' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10,
      }),
      // Traffic sources
      ga4Query(accessToken, propertyId, {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 8,
      }),
      // Devices
      ga4Query(accessToken, propertyId, {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
      }),
      // Daily sessions for chart
      ga4Query(accessToken, propertyId, {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
    ])

    // Parse overview
    const overviewRow = overviewData.rows?.[0]?.metricValues || []
    const overview = {
      sessions: parseInt(overviewRow[0]?.value || '0'),
      activeUsers: parseInt(overviewRow[1]?.value || '0'),
      pageViews: parseInt(overviewRow[2]?.value || '0'),
      bounceRate: parseFloat((parseFloat(overviewRow[3]?.value || '0') * 100).toFixed(1)),
      avgSessionDuration: parseFloat(parseFloat(overviewRow[4]?.value || '0').toFixed(0)),
      newUsers: parseInt(overviewRow[5]?.value || '0'),
    }

    // Parse top pages
    const topPages = (topPagesData.rows || []).map((row: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
      page: row.dimensionValues[0]?.value || '/',
      pageViews: parseInt(row.metricValues[0]?.value || '0'),
      users: parseInt(row.metricValues[1]?.value || '0'),
      avgDuration: parseFloat(parseFloat(row.metricValues[2]?.value || '0').toFixed(0)),
    }))

    // Parse sources
    const sources = (sourcesData.rows || []).map((row: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
      source: row.dimensionValues[0]?.value || 'Unknown',
      sessions: parseInt(row.metricValues[0]?.value || '0'),
      users: parseInt(row.metricValues[1]?.value || '0'),
    }))

    // Parse devices
    const devices = (devicesData.rows || []).map((row: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
      device: row.dimensionValues[0]?.value || 'Unknown',
      sessions: parseInt(row.metricValues[0]?.value || '0'),
      users: parseInt(row.metricValues[1]?.value || '0'),
    }))

    // Parse daily chart
    const chartData = (dailyData.rows || []).map((row: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => {
      const d = row.dimensionValues[0]?.value || ''
      return {
        date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
        sessions: parseInt(row.metricValues[0]?.value || '0'),
        users: parseInt(row.metricValues[1]?.value || '0'),
        pageViews: parseInt(row.metricValues[2]?.value || '0'),
      }
    })

    return NextResponse.json({
      connected: true,
      property: { id: propertyId, name: profile.ga4_property_name || propertyId },
      period: { startDate: '28 days ago', endDate: 'today' },
      overview,
      topPages,
      sources,
      devices,
      chartData,
    })
  } catch (e) {
    return NextResponse.json({ connected: true, error: (e as Error).message }, { status: 500 })
  }
}
