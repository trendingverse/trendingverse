import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { site_ids } = await req.json() // optional: push to specific sites only
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

  // Get all publisher sites
  let sitesQuery = admin.from('sites').select('id, site_url, wp_username, wp_app_password, name').eq('is_active', true)
  if (site_ids?.length) sitesQuery = sitesQuery.in('id', site_ids)

  const { data: sites } = await sitesQuery
  if (!sites?.length) return NextResponse.json({ error: 'No active sites found' }, { status: 400 })

  const results: { site: string; success: boolean; error?: string }[] = []

  for (const site of sites) {
    if (!site.wp_username || !site.wp_app_password) {
      results.push({ site: site.name, success: false, error: 'No WP credentials' })
      continue
    }

    try {
      const base = site.site_url.replace(/\/$/, '')
      const auth = Buffer.from(`${site.wp_username}:${site.wp_app_password}`).toString('base64')

      // Use WordPress REST API to update ads.txt via custom endpoint
      // Most sites support this via Simple Ads.txt plugin or custom endpoint
      // We'll use the WP filesystem approach via a custom REST route
     const res = await fetch(`${base}/wp-json/trendingverse/v1/ads-txt`, {
  method: 'POST',
  headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: adsTxtContent }),
})

if (!res.ok) {
  const errText = await res.text()
  results.push({ site: site.name, success: false, error: `${res.status}: ${errText.slice(0, 100)}` })
  continue
}

      if (res.ok) {
        results.push({ site: site.name, success: true })
      } else {
        // Fallback: create/update ads.txt as a WordPress option
        const optRes = await fetch(`${base}/wp-json/wp/v2/settings`, {
          method: 'POST',
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ 'trendingverse_ads_txt': adsTxtContent }),
        })
        results.push({ site: site.name, success: optRes.ok, error: optRes.ok ? undefined : 'Manual upload required' })
           }
    } catch (e) {
      results.push({ site: site.name, success: false, error: (e as Error).message })
    }
  }

  return NextResponse.json({
    success: true,
    ads_txt_content: adsTxtContent,
    results,
    total_sites: sites.length,
    successful: results.filter(r => r.success).length,
  })
}
