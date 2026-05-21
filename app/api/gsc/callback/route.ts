import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendingverse.vercel.app'

  if (!code || !userId) {
    return NextResponse.redirect(`${siteUrl}/admin/analytics?gsc=error&reason=missing_params`)
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GSC_REDIRECT_URI!,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenRes.json()
    if (!tokenRes.ok) throw new Error(tokens.error_description || tokens.error || 'Token exchange failed')

    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await admin.from('user_profiles').update({
      gsc_access_token: tokens.access_token,
      gsc_refresh_token: tokens.refresh_token || null,
      gsc_token_expiry: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
    }).eq('id', userId)

    return NextResponse.redirect(`${siteUrl}/admin/analytics?gsc=connected`)
  } catch (e) {
    const msg = encodeURIComponent((e as Error).message)
    return NextResponse.redirect(`${siteUrl}/admin/analytics?gsc=error&reason=${msg}`)
  }
}
