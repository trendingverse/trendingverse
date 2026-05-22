import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendingverse.vercel.app'
  const redirectUri = process.env.GA4_REDIRECT_URI || 'https://trendingverse.vercel.app/api/ga4/callback'

  if (!code || !userId) {
    return NextResponse.redirect(`${siteUrl}/admin/analytics?ga4=error&reason=missing_params`)
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenRes.json()
    if (!tokenRes.ok) throw new Error(tokens.error_description || tokens.error || 'Token exchange failed')

    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Save tokens
    await admin.from('user_profiles').update({
      ga4_access_token: tokens.access_token,
      ga4_refresh_token: tokens.refresh_token || null,
      ga4_token_expiry: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
    }).eq('id', userId)

    return NextResponse.redirect(`${siteUrl}/admin/analytics?ga4=select_property`)
  } catch (e) {
    const msg = encodeURIComponent((e as Error).message)
    return NextResponse.redirect(`${siteUrl}/admin/analytics?ga4=error&reason=${msg}`)
  }
}
