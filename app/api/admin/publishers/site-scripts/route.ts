// app/api/admin/publishers/site-scripts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key     = searchParams.get('key')
  const siteUrl = searchParams.get('site')

  if (!key) return NextResponse.json({ error: 'API key required' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Validate publisher API key (same as ad-codes route)
  const { data: profile } = await admin
    .from('user_profiles')
    .select('id')
    .eq('publisher_api_key', key)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  // Find the site
  const bare      = (siteUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
  const httpsUrl  = `https://${bare}`
  const httpUrl   = `http://${bare}`

  const { data: site } = await admin
    .from('sites')
    .select('id, head_scripts, footer_scripts')
    .eq('user_id', profile.id)
    .in('site_url', [httpUrl, httpsUrl, bare])
    .single()

  return NextResponse.json({
    head_scripts:   site?.head_scripts   || '',
    footer_scripts: site?.footer_scripts || '',
  })
}
