// lib/pacing-engine.ts
// Pure calculation logic for direct-ad campaign pacing. No DB, no side
// effects — just the math an ad-ops person uses to answer "are we on track?"

export interface Campaign {
  id: string
  pricing_model: 'cpm' | 'cpc' | 'flat'
  cpm_rate_inr?: number | null
  cpc_rate_inr?: number | null
  flat_fee_inr?: number | null
  total_budget_inr?: number | null
  daily_budget_inr?: number | null
  impressions_cap?: number | null
  target_impressions?: number | null
  daily_impression_cap?: number | null
  pacing: 'even' | 'asap'
  start_date?: string | null
  end_date?: string | null
  status: string
  impressions?: number | null
  clicks?: number | null
  spend_inr?: number | null
}

export interface PacingResult {
  // Goal
  goal_impressions: number | null   // derived delivery goal
  goal_basis: 'budget/cpm' | 'impressions_cap' | 'target_impressions' | 'none'
  // Progress
  delivered_impressions: number
  delivered_pct: number             // 0-100
  spend_inr: number
  budget_spent_pct: number          // 0-100
  // Time
  total_days: number
  days_elapsed: number
  days_remaining: number
  flight_pct: number                // how far through the flight, 0-100
  // Pacing
  expected_pct: number              // where delivery *should* be for even pacing
  pace_status: 'on_track' | 'under' | 'over' | 'not_started' | 'ended' | 'no_goal'
  daily_target: number | null       // impressions/day needed to finish on time
  today_remaining_budget_inr: number | null
  // Recommendations
  should_pause: boolean
  pause_reason: string | null
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
}

// Derive the delivery goal in impressions from whatever basis applies
export function deriveGoalImpressions(c: Campaign): { goal: number | null; basis: PacingResult['goal_basis'] } {
  // Explicit impression target wins if set
  if (c.target_impressions && c.target_impressions > 0) {
    return { goal: c.target_impressions, basis: 'target_impressions' }
  }
  if (c.impressions_cap && c.impressions_cap > 0) {
    return { goal: c.impressions_cap, basis: 'impressions_cap' }
  }
  // Otherwise derive from budget ÷ CPM (spend-primary model)
  if (c.pricing_model === 'cpm' && c.total_budget_inr && c.cpm_rate_inr && c.cpm_rate_inr > 0) {
    return { goal: Math.floor((c.total_budget_inr / c.cpm_rate_inr) * 1000), basis: 'budget/cpm' }
  }
  // CPC and flat campaigns have no impression goal
  return { goal: null, basis: 'none' }
}

// Compute spend from delivery based on the pricing model
export function computeSpend(c: Campaign, impressions: number, clicks: number): number {
  switch (c.pricing_model) {
    case 'cpm':
      return c.cpm_rate_inr ? (impressions / 1000) * c.cpm_rate_inr : 0
    case 'cpc':
      return c.cpc_rate_inr ? clicks * c.cpc_rate_inr : 0
    case 'flat':
      return c.flat_fee_inr || 0
    default:
      return 0
  }
}

export function computePacing(c: Campaign, now: Date = new Date()): PacingResult {
  const delivered = c.impressions || 0
  const clicks = c.clicks || 0
  const { goal, basis } = deriveGoalImpressions(c)
  const spend = computeSpend(c, delivered, clicks)

  const start = c.start_date ? new Date(c.start_date) : null
  const end = c.end_date ? new Date(c.end_date) : null

  const totalDays = start && end ? Math.max(1, daysBetween(start, end) + 1) : 0
  const daysElapsed = start ? Math.min(totalDays, daysBetween(start, now) + (now >= start ? 1 : 0)) : 0
  const daysRemaining = Math.max(0, totalDays - daysElapsed)
  const flightPct = totalDays > 0 ? Math.min(100, (daysElapsed / totalDays) * 100) : 0

  const deliveredPct = goal ? Math.min(100, (delivered / goal) * 100) : 0
  const budgetTotal =
    c.pricing_model === 'flat' ? (c.flat_fee_inr || 0) : (c.total_budget_inr || 0)
  const budgetSpentPct = budgetTotal > 0 ? Math.min(100, (spend / budgetTotal) * 100) : 0

  // Expected delivery for even pacing = same % as flight elapsed
  const expectedPct = c.pacing === 'asap' ? 100 : flightPct

  // Pace status
  let paceStatus: PacingResult['pace_status'] = 'on_track'
  if (!goal) paceStatus = 'no_goal'
  else if (start && now < start) paceStatus = 'not_started'
  else if (end && now > end) paceStatus = 'ended'
  else {
    const drift = deliveredPct - expectedPct
    if (drift < -10) paceStatus = 'under'       // more than 10% behind
    else if (drift > 10) paceStatus = 'over'    // more than 10% ahead
    else paceStatus = 'on_track'
  }

  // Daily target to finish remaining goal across remaining days (even pacing)
  let dailyTarget: number | null = null
  if (goal && daysRemaining > 0) {
    const remainingImps = Math.max(0, goal - delivered)
    dailyTarget = c.pacing === 'asap'
      ? remainingImps                          // ASAP: deliver all remaining now
      : Math.ceil(remainingImps / daysRemaining)
  }

  // Today's remaining budget (if a daily budget cap is set)
  let todayRemainingBudget: number | null = null
  if (c.daily_budget_inr && c.daily_budget_inr > 0) {
    // NOTE: caller should subtract today's already-spent from this;
    // here we return the cap, pacing cron does the day-scoped math.
    todayRemainingBudget = c.daily_budget_inr
  }

  // Should we auto-pause?
  let shouldPause = false
  let pauseReason: string | null = null
  if (end && now > end) {
    shouldPause = true; pauseReason = 'Flight end date passed'
  } else if (budgetTotal > 0 && spend >= budgetTotal) {
    shouldPause = true; pauseReason = 'Total budget spent'
  } else if (goal && delivered >= goal) {
    shouldPause = true; pauseReason = 'Impression goal reached'
  }

  return {
    goal_impressions: goal,
    goal_basis: basis,
    delivered_impressions: delivered,
    delivered_pct: Math.round(deliveredPct * 10) / 10,
    spend_inr: Math.round(spend * 100) / 100,
    budget_spent_pct: Math.round(budgetSpentPct * 10) / 10,
    total_days: totalDays,
    days_elapsed: daysElapsed,
    days_remaining: daysRemaining,
    flight_pct: Math.round(flightPct * 10) / 10,
    expected_pct: Math.round(expectedPct * 10) / 10,
    pace_status: paceStatus,
    daily_target: dailyTarget,
    today_remaining_budget_inr: todayRemainingBudget,
    should_pause: shouldPause,
    pause_reason: pauseReason,
  }
}

// Resolve what status a campaign SHOULD be in right now, given dates + delivery.
// Used by the cron to auto-transition draft→scheduled→active→completed.
export function resolveStatus(c: Campaign, now: Date = new Date()): string {
  if (c.status === 'draft') return 'draft' // draft stays until user schedules it
  if (c.status === 'paused') return 'paused' // manual pause is sticky

  const start = c.start_date ? new Date(c.start_date) : null
  const end = c.end_date ? new Date(c.end_date) : null
  const { goal } = deriveGoalImpressions(c)
  const delivered = c.impressions || 0
  const spend = computeSpend(c, delivered, c.clicks || 0)
  const budgetTotal = c.pricing_model === 'flat' ? (c.flat_fee_inr || 0) : (c.total_budget_inr || 0)

  // Completed conditions
  if (end && now > end) return 'completed'
  if (goal && delivered >= goal) return 'completed'
  if (budgetTotal > 0 && spend >= budgetTotal) return 'completed'

  // Scheduled vs active
  if (start && now < start) return 'scheduled'
  return 'active'
}

// UI helper — colour + label for pace status
export function paceStatusColor(status: PacingResult['pace_status']): string {
  switch (status) {
    case 'on_track': return 'text-green-600 bg-green-50'
    case 'under':    return 'text-amber-600 bg-amber-50'
    case 'over':     return 'text-blue-600 bg-blue-50'
    case 'ended':    return 'text-ink-500 bg-ink-100'
    case 'not_started': return 'text-violet-600 bg-violet-50'
    default:         return 'text-ink-400 bg-ink-50'
  }
}

export function paceStatusLabel(status: PacingResult['pace_status']): string {
  switch (status) {
    case 'on_track': return 'On track'
    case 'under':    return 'Under-pacing'
    case 'over':     return 'Over-pacing'
    case 'ended':    return 'Flight ended'
    case 'not_started': return 'Not started'
    case 'no_goal':  return 'No impression goal'
    default:         return status
  }
}
