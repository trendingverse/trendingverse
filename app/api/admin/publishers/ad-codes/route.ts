import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  const siteUrl = searchParams.get('site')

  if (!key) return NextResponse.json({ error: 'API key required' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Look up publisher by API key
  const { data: profile } = await admin
    .from('user_profiles')
    .select('id, plan')
    .eq('publisher_api_key', key)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  // Normalize URL — strip protocol and trailing slash
  const bare = (siteUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
  const httpUrl  = `http://${bare}`
  const httpsUrl = `https://${bare}`

  // Match site by both http and https variants
  const { data: site } = await admin
    .from('sites')
    .select('id, name, site_url')
    .eq('user_id', profile.id)
    .in('site_url', [httpUrl, httpsUrl, bare])
    .single()

  if (!site) {
    return NextResponse.json({
      publisher: profile.id,
      site: null,
      ads: [],
      message: `No site found for ${siteUrl} — please add your site in TrendingVerse CMS Settings`,
    })
  }

  // Fetch active ad assignments for this publisher + site only
  const { data: assignments } = await admin
    .from('publisher_ads')
    .select(`
      id,
      is_enabled,
      inject_after_paragraph,
      revenue_share_pct,
      ad_units (
        id,
        ad_type,
        position,
        ad_code,
        gam_network_code,
        gam_unit_path,
        size_width,
        size_height
      )
    `)
    .eq('publisher_id', profile.id)
    .eq('site_id', site.id)
    .eq('is_enabled', true)

  const ads = (assignments || []).map(a => {
    const unit = Array.isArray(a.ad_units) ? a.ad_units[0] : a.ad_units
    return {
      id: unit?.id,
      ad_type: unit?.ad_type,
      position: unit?.position,
      ad_code: unit?.ad_code,
      gam_network_code: unit?.gam_network_code,
      gam_unit_path: unit?.gam_unit_path,
      size_width: unit?.size_width,
      size_height: unit?.size_height,
      is_enabled: a.is_enabled,
      inject_after_paragraph: a.inject_after_paragraph,
      revenue_share_pct: a.revenue_share_pct,
    }
  })

  return NextResponse.json({
    publisher: profile.id,
    site: { id: site.id, name: site.name, url: site.site_url },
    ads,
    cached_until: new Date(Date.now() + 3600000).toISOString(),
  })
}
