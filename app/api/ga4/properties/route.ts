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

// GET — list all GA4 properties for the user
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

  if (!profile?.ga4_access_token) {
    return NextResponse.json({ connected: false })
  }

  // Refresh if expired
  let accessToken = profile.ga4_access_token
  if (profile.ga4_token_expiry && new Date(profile.ga4_token_expiry) <= new Date()) {
    if (!profile.ga4_refresh_token) return NextResponse.json({ connected: false, error: 'Token expired — reconnect GA4' })
    const newToken = await refreshToken(profile.ga4_refresh_token)
    if (!newToken) return NextResponse.json({ connected: false, error: 'Token refresh failed' })
    accessToken = newToken
    await admin.from('user_profiles').update({
      ga4_access_token: newToken,
      ga4_token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
    }).eq('id', user.id)
  }

  // Fetch GA4 properties from Google Analytics Admin API
  const res = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  if (!res.ok) {
    const err = await res.json()
    return NextResponse.json({ connected: true, error: err.error?.message || 'Failed to fetch properties' })
  }

  const data = await res.json()
  const properties: { id: string; name: string; displayName: string; accountName: string }[] = []

  for (const account of data.accountSummaries || []) {
    for (const prop of account.propertySummaries || []) {
      properties.push({
        id: prop.property.replace('properties/', ''),
        name: prop.property,
        displayName: prop.displayName,
        accountName: account.displayName,
      })
    }
  }

  return NextResponse.json({
    connected: true,
    properties,
    selected_property_id: profile.ga4_property_id,
    selected_property_name: profile.ga4_property_name,
  })
}

// POST — save selected property
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { property_id, property_name } = await req.json()

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await admin.from('user_profiles').update({
    ga4_property_id: property_id,
    ga4_property_name: property_name,
  }).eq('id', user.id)

  return NextResponse.json({ success: true })
}
