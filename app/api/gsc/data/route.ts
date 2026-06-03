import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
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
    if (!res.ok || !data.access_token) {
      console.error('GSC token refresh failed:', data.error, data.error_description)
      return null
    }
    return { access_token: data.access_token, expires_in: data.expires_in || 3600 }
  } catch (e) {
    console.error('GSC token refresh exception:', e)
    return null
  }
}

async function gscQuery(accessToken: string, siteUrl: string, payload: Record<string, unknown>) {
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || `GSC API error ${res.status}`)
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
    .select('gsc_access_token, gsc_refresh_token, gsc_token_expiry, gsc_site_url')
    .eq('id', user.id)
    .single()

  if (!profile?.gsc_access_token && !profile?.gsc_refresh_token) {
    return NextResponse.json({ connected: false })
  }

  let accessToken = profile.gsc_access_token

  // Refresh if expired OR no access token but refresh token exists
  const isExpired = !profile.gsc_token_expiry || new Date(profile.gsc_token_expiry) <= new Date()
  const needsRefresh = isExpired || !accessToken

  if (needsRefresh) {
    if (!profile.gsc_refresh_token) {
      return NextResponse.json({
        connected: false,
        needs_reconnect: true,
        error: 'Session expired — please reconnect Google Search Console',
      })
    }

    const refreshed = await refreshAccessToken(profile.gsc_refresh_token)
    if (!refreshed) {
      // Clear invalid tokens so user reconnects cleanly
      await admin.from('user_profiles').update({
        gsc_access_token: null,
        gsc_token_expiry: null,
      }).eq('id', user.id)

      return NextResponse.json({
        connected: false,
        needs_reconnect: true,
        error: 'GSC session expired — please click Reconnect to re-authorise',
      })
    }

    accessToken = refreshed.access_token
    await admin.from('user_profiles').update({
      gsc_access_token: accessToken,
      gsc_token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    }).eq('id', user.id)
  }

  const siteUrl = profile.gsc_site_url || 'https://trendingverse.online'
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  try {
    // Test token validity with a lightweight request first
    const testRes = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    // If 401 even after refresh — need to reconnect
    if (testRes.status === 401) {
      await admin.from('user_profiles').update({
        gsc_access_token: null,
        gsc_token_expiry: null,
      }).eq('id', user.id)
      return NextResponse.json({
        connected: false,
        needs_reconnect: true,
        error: 'GSC authorisation expired — please reconnect',
      })
    }

    const [overview, topPages, topQueries, discoverData] = await Promise.all([
      gscQuery(accessToken, siteUrl, { startDate, endDate, dimensions: ['date'], rowLimit: 28 }),
      gscQuery(accessToken, siteUrl, {
        startDate, endDate, dimensions: ['page'], rowLimit: 10,
        orderBy: [{ fieldName: 'clicks', sortOrder: 'DESCENDING' }],
      }),
      gscQuery(accessToken, siteUrl, {
        startDate, endDate, dimensions: ['query'], rowLimit: 10,
        orderBy: [{ fieldName: 'clicks', sortOrder: 'DESCENDING' }],
      }),
      gscQuery(accessToken, siteUrl, {
        startDate, endDate, dimensions: ['page'], rowLimit: 5,
        dimensionFilterGroups: [{ filters: [{ dimension: 'searchType', operator: 'equals', expression: 'discover' }] }],
      }).catch(() => ({ rows: [] })),
    ])

    const rows = overview.rows || []
    const totalClicks = rows.reduce((s: number, r: { clicks: number }) => s + r.clicks, 0)
    const totalImpressions = rows.reduce((s: number, r: { impressions: number }) => s + r.impressions, 0)
    const avgCTR = totalImpressions > 0 ? parseFloat((totalClicks / totalImpressions * 100).toFixed(2)) : 0
    const avgPosition = rows.length > 0
      ? parseFloat((rows.reduce((s: number, r: { position: number }) => s + r.position, 0) / rows.length).toFixed(1))
      : 0

    const lowCtrPages = (topPages.rows || [])
      .filter((r: { impressions: number; ctr: number }) => r.impressions > 100 && r.ctr < 0.01)
      .slice(0, 5)

    return NextResponse.json({
      connected: true,
      site: siteUrl,
      period: { startDate, endDate },
      overview: { totalClicks, totalImpressions, avgCTR, avgPosition },
      chartData: rows.map((r: { keys: string[]; clicks: number; impressions: number; ctr: number }) => ({
        date: r.keys[0], clicks: r.clicks, impressions: r.impressions,
        ctr: parseFloat((r.ctr * 100).toFixed(2)),
      })),
      topPages: (topPages.rows || []).map((r: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => ({
        page: r.keys[0].replace(siteUrl, ''), clicks: r.clicks, impressions: r.impressions,
        ctr: parseFloat((r.ctr * 100).toFixed(2)), position: parseFloat(r.position.toFixed(1)),
      })),
      topQueries: (topQueries.rows || []).map((r: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => ({
        query: r.keys[0], clicks: r.clicks, impressions: r.impressions,
        ctr: parseFloat((r.ctr * 100).toFixed(2)), position: parseFloat(r.position.toFixed(1)),
      })),
      discoverPages: (discoverData.rows || []).map((r: { keys: string[]; clicks: number; impressions: number }) => ({
        page: r.keys[0].replace(siteUrl, ''), clicks: r.clicks, impressions: r.impressions,
      })),
      lowCtrPages: lowCtrPages.map((r: { keys: string[]; clicks: number; impressions: number; ctr: number }) => ({
        page: r.keys[0].replace(siteUrl, ''), clicks: r.clicks,
        impressions: r.impressions, ctr: parseFloat((r.ctr * 100).toFixed(2)),
      })),
    })
  } catch (e) {
    return NextResponse.json({ connected: true, error: (e as Error).message }, { status: 500 })
  }
}
