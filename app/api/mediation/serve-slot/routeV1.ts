// app/api/mediation/serve-slot/route.ts
// ══════════════════════════════════════════════════════════════════
// UNIVERSAL SLOT SERVER — the multi-partner mediation brain.
//
// Given a slot (site, position, size, visitor), returns an ORDERED list
// of demand sources for the universal tag to try until one fills:
//   [ direct campaign (if any), partner A, partner B, ... ]
//
// Phase 1: order comes from demand_partners.waterfall_order (you set it).
// Phase 3: the optimisation job rewrites measured_ecpm_inr per placement,
//          and this endpoint orders by that instead — same shape, smarter order.
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

  // ── 1. DIRECT campaign first look (reuse your existing serve-ad brain) ──
  // A paid direct campaign always outranks network partners. We call the
  // existing direct decisioning by querying direct_ads the same way serve-ad
  // does — kept minimal here; if you want the full tier/floor/geo logic,
  // this can call your existing serve-ad internally instead.
  if (fingerprint) {
    const today = new Date().toISOString().split('T')[0]
    const { data: directAds } = await admin
      .from('direct_ads')
      .select('*')
      .eq('is_active', true)
      .eq('approval_status', 'approved')
      .eq('position', pos)
      .or(`start_date.is.null,start_date.lte.${today}`)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .limit(1)
    if (directAds && directAds.length) {
      const d = directAds[0]
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
  }

  // ── 2. NETWORK PARTNERS, ordered by waterfall_order (Phase 1) ──
  // Pull active partners. For each, find the best matching placement code
  // (site+position+size specific > site+position > partner template).
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
    // Find the most specific placement override for this partner + slot
    const candidates = (placements || []).filter((pl: any) => {
      if (pl.partner_id !== p.id) return false
      const plSite = (pl.site_url || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
      const siteOk = !pl.site_url || (normSite && (normSite.includes(plSite) || plSite.includes(normSite)))
      const posOk = !pl.position || pl.position === pos
      const sizeOk = (!pl.size_width || pl.size_width === w) && (!pl.size_height || pl.size_height === h)
      return siteOk && posOk && sizeOk
    })
    // Prefer the most specific (site+pos+size) placement; else partner template
    candidates.sort((a: any, b: any) => {
      const spec = (x: any) => (x.site_url ? 4 : 0) + (x.position ? 2 : 0) + (x.size_width ? 1 : 0)
      return spec(b) - spec(a)
    })
    const chosen = candidates[0]
    const rawCode = chosen?.ad_code || p.ad_code_template
    if (!rawCode) continue // partner has no code for this slot — skip

    demand.push({
      source: p.slug,
      type: 'network',
      name: p.name,
      // Effective order: placement override wins, else partner-level
      order: chosen?.waterfall_order ?? p.waterfall_order,
      ad_code: fillTemplate(rawCode, { w, h, slotId }),
    })
  }

  // Sort network partners by their effective order (direct stays first)
  const direct = demand.filter(d => d.type === 'direct')
  const network = demand.filter(d => d.type === 'network').sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
  const ordered = [...direct, ...network]

  // Log the request (Phase 2 will aggregate fills into eCPM)
  admin.from('mediation_events').insert({
    fingerprint, site_url: normSite, position: pos,
    partner_slug: 'request', event_type: 'request',
  }).then(() => {}, () => {})

  return NextResponse.json({
    slot_id: slotId,
    demand: ordered,        // the tag tries these in order until one fills
    width: w, height: h,
  }, { headers: CORS })
}
