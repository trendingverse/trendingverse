// app/api/mediation/serve-slot/route.ts  — v2
// ══════════════════════════════════════════════════════════════════
// UNIVERSAL SLOT SERVER — multi-partner mediation brain.
//
// v2 change: the DIRECT-ad decision now reuses your real serve-ad
// endpoint (with all its geo / tier / gender / floor logic) instead of a
// naive "first active direct ad" query. This stops the geo-scoped house
// ad from leaking into every slot and cannibalising network revenue.
//
// Flow: ask serve-ad for the direct decision → if it returns a paid/eligible
// direct ad, that's first in the waterfall → then append network partners
// ordered by waterfall_order.
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS })
}

function fillTemplate(tpl: string, ctx: { w: number; h: number; slotId: string }) {
  return (tpl || '')
    .replace(/\{\{WIDTH\}\}/g, String(ctx.w))
    .replace(/\{\{HEIGHT\}\}/g, String(ctx.h))
    .replace(/\{\{SLOT_ID\}\}/g, ctx.slotId)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { site_url, position, width, height, fingerprint, slot_id } = body
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const w = parseInt(width, 10) || 300
  const h = parseInt(height, 10) || 250
  const pos = position || 'in_content'
  const normSite = (site_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
  const slotId = slot_id || `slot_${Math.random().toString(36).slice(2, 10)}`

  const demand: any[] = []

  // ── 1. DIRECT decision — delegate to the real serve-ad (single source of
  //      truth for geo / tier / gender / floor rules). If it returns an ad,
  //      it's an eligible paid/house direct ad that PASSED all targeting.
  //      A geo-scoped house ad will NOT come back for non-matching visitors.
  try {
    const origin = new URL(req.url).origin
    const saRes = await fetch(`${origin}/api/audience/serve-ad`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint, site_url, position: pos }),
    })
    if (saRes.ok) {
      const sa = await saRes.json()
      if (sa && sa.ad) {
        const d = sa.ad
        demand.push({
          source: 'direct',
          type: 'direct',
          ad_id: d.id,
          headline: d.headline,
          description: d.description,
          image_url: d.image_url,
          cta_text: d.cta_text,
          destination_url: d.destination_url,
          size_width: d.size_width,
          size_height: d.size_height,
        })
      }
      // if sa.ad is null (fallback:'network'), we simply add no direct item —
      // the waterfall proceeds straight to network partners. Correct behaviour.
    }
  } catch { /* serve-ad unreachable — proceed with network only */ }

  // ── 2. NETWORK PARTNERS, ordered by waterfall_order ──
  const { data: partners } = await admin
    .from('demand_partners')
    .select('*')
    .eq('is_active', true)
    .order('waterfall_order', { ascending: true })

  const { data: placements } = await admin
    .from('demand_partner_placements')
    .select('*')
    .eq('is_active', true)

  for (const p of partners || []) {
    const candidates = (placements || []).filter((pl: any) => {
      if (pl.partner_id !== p.id) return false
      const plSite = (pl.site_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
      const siteOk = !pl.site_url || (normSite && (normSite.includes(plSite) || plSite.includes(normSite)))
      const posOk = !pl.position || pl.position === pos
      const sizeOk = (!pl.size_width || pl.size_width === w) && (!pl.size_height || pl.size_height === h)
      return siteOk && posOk && sizeOk
    })
    candidates.sort((a: any, b: any) => {
      const spec = (x: any) => (x.site_url ? 4 : 0) + (x.position ? 2 : 0) + (x.size_width ? 1 : 0)
      return spec(b) - spec(a)
    })
    const chosen = candidates[0]
    const rawCode = chosen?.ad_code || p.ad_code_template
    if (!rawCode) continue

    demand.push({
      source: p.slug,
      type: 'network',
      name: p.name,
      order: chosen?.waterfall_order ?? p.waterfall_order,
      ad_code: fillTemplate(rawCode, { w, h, slotId }),
    })
  }

  const direct = demand.filter(d => d.type === 'direct')
  const network = demand.filter(d => d.type === 'network').sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
  const ordered = [...direct, ...network]

  admin.from('mediation_events').insert({
  fingerprint, site_url: normSite, position: pos,
  partner_slug: null, event_type: 'request',
}).then(() => {}, () => {})

  return NextResponse.json({
    slot_id: slotId,
    demand: ordered,
    width: w, height: h,
  }, { headers: CORS })
}
