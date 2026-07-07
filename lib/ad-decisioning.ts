// lib/ad-decisioning.ts
// Decides which direct campaign wins a given ad slot, following the
// standard ad-server model:
//   1. PRIORITY TIER  — higher tier always beats lower (protects guaranteed)
//   2. VALUE          — within a tier, higher effective CPM wins
//   3. WEIGHTED ROTATION — near-equal value in a tier splits by weight
// Plus eligibility gates: flight dates, status, targeting, frequency,
// and the placement floor.

export interface DecisionCampaign {
  id: string
  campaign_name?: string
  status: string
  is_active?: boolean
  priority_tier: number        // 1=Sponsorship .. 4=House
  delivery_weight: number      // rotation weight within a tier
  pricing_model: 'cpm' | 'cpc' | 'flat'
  cpm_rate_inr?: number | null
  cpc_rate_inr?: number | null
  flat_fee_inr?: number | null
  floor_cpm_inr?: number | null
  start_date?: string | null
  end_date?: string | null
  // targeting (already-resolved booleans passed in by the caller)
  target_all?: boolean
}

export interface SlotContext {
  now?: Date
  placementFloorCpm?: number   // floor for THIS slot (from placement_floors)
  // The caller resolves targeting match separately and only passes
  // campaigns that already match geo/device/segment/site for this request.
}

// Effective value of a campaign for ranking. For CPM it's the rate;
// for CPC/flat we can't directly compare per-impression, so we treat
// them as their configured rate and let tier + weight dominate.
function effectiveValue(c: DecisionCampaign): number {
  if (c.pricing_model === 'cpm') return c.cpm_rate_inr || 0
  if (c.pricing_model === 'cpc') return c.cpc_rate_inr || 0
  return c.flat_fee_inr || 0
}

// Is this campaign eligible to serve right now?
function isEligible(c: DecisionCampaign, ctx: SlotContext): boolean {
  const now = ctx.now || new Date()

  // Status / active
  if (c.status === 'paused' || c.status === 'completed' || c.status === 'draft') return false
  if (c.is_active === false) return false

  // Flight window
  if (c.start_date && new Date(c.start_date) > now) return false
  if (c.end_date) {
    const end = new Date(c.end_date)
    end.setHours(23, 59, 59, 999)
    if (end < now) return false
  }

  // Floor gate — the campaign's CPM must clear the placement floor.
  // Only meaningful for CPM campaigns; CPC/flat are sold differently.
  if (c.pricing_model === 'cpm') {
    const floor = Math.max(ctx.placementFloorCpm || 0, c.floor_cpm_inr || 0)
    if (floor > 0 && (c.cpm_rate_inr || 0) < floor) return false
  }

  return true
}

// Pick a winner from a list of campaigns already matched to the request.
export function decideWinner(campaigns: DecisionCampaign[], ctx: SlotContext = {}): DecisionCampaign | null {
  const eligible = campaigns.filter(c => isEligible(c, ctx))
  if (!eligible.length) return null

  // 1) Highest priority tier wins (tier 1 beats tier 2 beats ...).
  //    Lower number = higher priority.
  const topTier = Math.min(...eligible.map(c => c.priority_tier || 4))
  const tierPool = eligible.filter(c => (c.priority_tier || 4) === topTier)
  if (tierPool.length === 1) return tierPool[0]

  // 2) Within the tier, rank by effective value (higher CPM/rate wins).
  //    If the top values are within 10% of each other, treat them as a
  //    contested set and go to weighted rotation — this prevents a ₹0.01
  //    CPM edge from starving an otherwise-equal campaign.
  const sorted = [...tierPool].sort((a, b) => effectiveValue(b) - effectiveValue(a))
  const topValue = effectiveValue(sorted[0])
  const contested = sorted.filter(c => {
    const v = effectiveValue(c)
    return topValue > 0 ? v >= topValue * 0.9 : true
  })

  if (contested.length === 1) return contested[0]

  // 3) Weighted rotation among the contested set — pick by delivery_weight.
  return weightedPick(contested)
}

// Weighted random selection by delivery_weight (even delivery over many
// requests: a weight-3 campaign serves ~3x as often as a weight-1).
function weightedPick(campaigns: DecisionCampaign[]): DecisionCampaign {
  const total = campaigns.reduce((s, c) => s + Math.max(1, c.delivery_weight || 1), 0)
  let r = Math.random() * total
  for (const c of campaigns) {
    r -= Math.max(1, c.delivery_weight || 1)
    if (r <= 0) return c
  }
  return campaigns[0]
}

// UI helpers — tier labels + colours for the admin panel
export const TIER_LABELS: Record<number, string> = {
  1: 'Sponsorship',
  2: 'Standard',
  3: 'Network',
  4: 'House',
}
export function tierColor(tier: number): string {
  switch (tier) {
    case 1: return 'bg-violet-100 text-violet-700'
    case 2: return 'bg-blue-100 text-blue-700'
    case 3: return 'bg-amber-100 text-amber-700'
    default: return 'bg-ink-100 text-ink-500'
  }
}
