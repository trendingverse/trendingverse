// app/api/adunits/route.ts
// Returns all ad units from Monetization for campaign targeting
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get all ad units with their site_url from publisher_ads join
  const { data: units } = await admin
    .from('ad_units')
    .select(`
      id, name, position, size_width, size_height,
      is_active, network_name, site_url, ad_code
    `)
    .eq('is_active', true)
    .order('position')

  // For units without site_url, try to get from publisher_ads
  const { data: assignments } = await admin
    .from('publisher_ads')
    .select('ad_unit_id, sites(site_url)')
    .eq('is_enabled', true)

  const siteMap: Record<string, string> = {}
  for (const a of assignments || []) {
    if (a.ad_unit_id && (a.sites as any)?.site_url) {
      siteMap[a.ad_unit_id] = (a.sites as any).site_url
    }
  }

  const enriched = (units || []).map(u => ({
    ...u,
    site_url: u.site_url || siteMap[u.id] || '',
    network_name: u.network_name || detectNetwork(u.ad_code || ''),
  }))

  return NextResponse.json(enriched)
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { id, ...updates } = await req.json()
  await admin.from('ad_units').update(updates).eq('id', id)
  return NextResponse.json({ success: true })
}

function detectNetwork(adCode: string): string {
  const code = adCode.toLowerCase()
  if (code.includes('googlesyndication') || code.includes('adsbygoogle')) return 'adsense'
  if (code.includes('highperformanceformat') || code.includes('adsterra')) return 'adsterra'
  if (code.includes('media.net')) return 'medianet'
  if (code.includes('taboola')) return 'taboola'
  if (code.includes('mgid')) return 'mgid'
  return 'other'
}
