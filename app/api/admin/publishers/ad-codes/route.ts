// app/api/publishers/ads-txt/route.ts
// Serves a publisher's authorized-seller lines as plain text at
// publisher.com/ads.txt. Uses the SAME auth resolution as the
// ad-codes endpoint: publisher_api_key → user_profiles.id → site.
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function plain(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Robots-Tag': 'noindex',
    },
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  const siteUrl = searchParams.get('site')

  if (!key) return plain('# TrendingVerse: API key required\n')

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1) Resolve publisher by API key (same as ad-codes route)
  const { data: profile } = await admin
    .from('user_profiles')
    .select('id')
    .eq('publisher_api_key', key)
    .single()

  if (!profile) return plain('# TrendingVerse: invalid API key\n')

  // 2) Resolve the site by user_id + url variants (same as ad-codes route)
  const bare = (siteUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
  const httpUrl = `http://${bare}`
  const httpsUrl = `https://${bare}`

  const { data: site } = await admin
    .from('sites')
    .select('id, site_url, ads_txt_variables')
    .eq('user_id', profile.id)
    .in('site_url', [httpUrl, httpsUrl, bare])
    .single()

  if (!site) return plain(`# TrendingVerse: no site found for ${siteUrl}\n`)

  // 3) Pull this site's active authorized-seller entries
  const { data: entries } = await admin
    .from('ads_txt_entries')
    .select('ad_system, publisher_id, relationship, cert_authority_id')
    .eq('site_id', site.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  const lines: string[] = [
    '# ads.txt managed by TrendingVerse CMS',
    `# Last updated: ${new Date().toISOString()}`,
    '',
  ]

  if (site.ads_txt_variables) {
    lines.push(site.ads_txt_variables.trim(), '')
  }

  for (const e of entries || []) {
    let line = `${e.ad_system}, ${e.publisher_id}, ${e.relationship}`
    if (e.cert_authority_id) line += `, ${e.cert_authority_id}`
    lines.push(line)
  }

  if (!entries?.length) lines.push('# No authorized sellers configured yet')

  return plain(lines.join('\n') + '\n')
}
