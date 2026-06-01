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
    .select('user_id, plan, byoak_keys')
    .eq('publisher_api_key', key)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  // Find the site
  const cleanUrl = (siteUrl || '').replace(/\/$/, '')
  const { data: site } = await admin
    .from('sites')
    .select('id, name, site_url')
    .eq('user_id', profile.user_id)
    .ilike('site_url', `%${cleanUrl.replace(/^https?:\/\//, '')}%`)
    .single()

  if (!site) {
    return NextResponse.json({
      publisher: profile.user_id,
      site: null,
      ads: [],
      message: 'No site found matching this URL — please add your site in TrendingVerse CMS Settings'
    })
  }

  // Fetch active ad assignments for this publisher + site
  const { data: assignments } = await admin
    .from('publisher_ads')
    .select(`
      id,
      is_enabled,
      inject_after_paragraph,
      revenue_share_pct,
      ad_units (
        id,
        name,
        ad_type,
        position,
        ad_code,
        gam_network_code,
        gam_unit_path,
        size_width,
        size_height
      )
    `)
    .eq('publisher_id', profile.user_id)
    .eq('site_id', site.id)
    .eq('is_enabled', true)

  const ads = (assignments || []).map(a => ({
    id: a.ad_units?.id,
    name: a.ad_units?.name,
    ad_type: a.ad_units?.ad_type,
    position: a.ad_units?.position,
    ad_code: a.ad_units?.ad_code,
    gam_network_code: a.ad_units?.gam_network_code,
    gam_unit_path: a.ad_units?.gam_unit_path,
    size_width: a.ad_units?.size_width,
    size_height: a.ad_units?.size_height,
    is_enabled: a.is_enabled,
    inject_after_paragraph: a.inject_after_paragraph,
    revenue_share_pct: a.revenue_share_pct,
  }))

  return NextResponse.json({
    publisher: profile.user_id,
    site: { id: site.id, name: site.name, url: site.site_url },
    ads,
    cached_until: new Date(Date.now() + 3600000).toISOString(),
  })
}
