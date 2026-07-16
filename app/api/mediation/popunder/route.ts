// app/api/mediation/popunder/route.ts
// ══════════════════════════════════════════════════════════════════
// Returns page-level (popunder / interstitial) ad codes for a site.
// The WordPress plugin calls this and injects the codes into <head>,
// once per page — the correct way to serve popunders (not slot-based).
//
// Reads demand_partner_placements where position = 'popunder', matching
// the site (or global placements with no site). Only active partners.
//
// GET ?key=PUBLISHER_KEY&site=https://trendingverse.online
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function svc() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
function hostOf(u: string) {
  try { return new URL(u).host.replace(/^www\./, '').toLowerCase() } catch { return (u || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').toLowerCase() }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const site = url.searchParams.get('site') || ''
  // key is accepted for parity with the plugin's other calls; we don't
  // hard-gate here since these are public ad codes served on the site anyway.
  if (!site) return NextResponse.json({ codes: [] })

  const admin = svc()
  const host = hostOf(site)

  // active popunder placements from active partners
  const { data: placements } = await admin
    .from('demand_partner_placements')
    .select('ad_code, site_url, is_active, partner_id, position')
    .eq('position', 'popunder')
    .eq('is_active', true)
    .limit(50)

  if (!placements?.length) return NextResponse.json({ codes: [] })

  // which partners are active
  const partnerIds = Array.from(new Set(placements.map(p => p.partner_id)))
  const { data: partners } = await admin
    .from('demand_partners').select('id, is_active').in('id', partnerIds)
  const activePartner: Record<string, boolean> = {}
  for (const p of partners || []) activePartner[p.id] = !!p.is_active

  const codes = placements
    .filter(p => activePartner[p.partner_id])
    .filter(p => {
      // match this site, or global (no site_url)
      if (!p.site_url) return true
      return hostOf(p.site_url) === host
    })
    .map(p => p.ad_code)
    .filter(Boolean)

  const res = NextResponse.json({ codes })
  res.headers.set('Cache-Control', 'public, max-age=300') // 5-min CDN cache
  return res
}
