import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { site_ids } = await req.json()
  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Get all ads.txt entries
  const { data: entries } = await admin.from('ads_txt_entries').select('*').eq('is_active', true)
  if (!entries?.length) return NextResponse.json({ error: 'No ads.txt entries found' }, { status: 400 })

  // Build ads.txt content
  const adsTxtContent = [
    '# TrendingVerse CMS — ads.txt',
    `# Updated: ${new Date().toISOString().split('T')[0]}`,
    '',
    ...entries.map(e => {
      const parts = [e.domain, e.publisher_id, e.relationship]
      if (e.certification_authority_id) parts.push(e.certification_authority_id)
      return parts.join(', ')
    })
  ].join('\n')

  // Get all active publisher sites
  let sitesQuery = admin.from('sites')
    .select('id, name, site_url, wp_username, wp_app_password')
    .eq('is_active', true)
  if (site_ids?.length) sitesQuery = sitesQuery.in('id', site_ids)

  const { data: sites } = await sitesQuery
  if (!sites?.length) return NextResponse.json({ error: 'No active sites found' }, { status: 400 })

  const results: { site: string; success: boolean; method?: string; error?: string }[] = []

  for (const site of sites) {
    if (!site.wp_username || !site.wp_app_password) {
      results.push({ site: site.name, success: false, error: 'No WordPress credentials' })
      continue
    }

    const base = site.site_url.replace(/\/$/, '')
    const auth = Buffer.from(`${site.wp_username}:${site.wp_app_password}`).toString('base64')

    // Method 1: Try TrendingVerse custom plugin
    try {
      const res = await fetch(`${base}/wp-json/trendingverse/v1/ads-txt`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: adsTxtContent }),
      })
      if (res.ok) {
        results.push({ site: site.name, success: true, method: 'trendingverse-plugin' })
        continue
      }
    } catch { /* try next method */ }

    // Method 2: Try 10up Ads.txt Manager plugin
    // This plugin stores ads.txt content in wp_options via REST API settings endpoint
    try {
      const res = await fetch(`${base}/wp-json/wp/v2/settings`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ adstxtmanager_ads_txt_content: adsTxtContent }),
      })
      if (res.ok) {
        results.push({ site: site.name, success: true, method: '10up-ads-txt-manager' })
        continue
      }
    } catch { /* try next method */ }

    // Method 3: Try updating via WordPress options API directly
    try {
      const res = await fetch(`${base}/wp-json/wp/v2/settings`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ads_txt: adsTxtContent }),
      })
      if (res.ok) {
        results.push({ site: site.name, success: true, method: 'wp-settings' })
        continue
      }
    } catch { /* try next method */ }

    // Method 4: Try Rank Math SEO ads.txt endpoint
    try {
      const res = await fetch(`${base}/wp-json/rankmath/v1/updateAdsTxt`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: adsTxtContent }),
      })
      if (res.ok) {
        results.push({ site: site.name, success: true, method: 'rankmath' })
        continue
      }
    } catch { /* try next method */ }

    // All methods failed
    results.push({
      site: site.name,
      success: false,
      error: 'Could not update ads.txt automatically. Please install the TrendingVerse Ads.txt Manager plugin or update manually.'
    })
  }

  return NextResponse.json({
    success: true,
    ads_txt_content: adsTxtContent,
    results,
    total_sites: sites.length,
    successful: results.filter(r => r.success).length,
  })
}
