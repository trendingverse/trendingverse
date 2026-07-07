// app/api/advertiser/dashboard/route.ts
// Returns delivery data for the LOGGED-IN advertiser's own campaigns only.
// Scoped by auth user id — an advertiser can never see another's data.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verify this user is actually an advertiser
  const { data: profile } = await admin
    .from('user_profiles')
    .select('role, company_name')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'advertiser') {
    return NextResponse.json({ error: 'Not an advertiser account' }, { status: 403 })
  }

  // Their campaigns only — scoped by advertiser_user_id
  const { data: campaigns } = await admin
    .from('direct_ads')
    .select('id, campaign_name, status, approval_status, ad_type, headline, start_date, end_date, impressions, viewable_impressions, clicks, cpm_rate_inr, total_budget_inr, spend_inr, target_impressions, impressions_cap')
    .eq('advertiser_user_id', user.id)
    .order('created_at', { ascending: false })

  const list = campaigns || []

  // Roll up totals across their campaigns
  const totals = list.reduce((acc, c) => {
    acc.impressions += c.impressions || 0
    acc.viewable += c.viewable_impressions || 0
    acc.clicks += c.clicks || 0
    acc.spend += c.spend_inr || 0
    return acc
  }, { impressions: 0, viewable: 0, clicks: 0, spend: 0 })

  const summary = {
    company_name: profile.company_name || '',
    campaigns: list.length,
    active: list.filter(c => c.status === 'active').length,
    impressions: totals.impressions,
    viewable_impressions: totals.viewable,
    viewability_rate: totals.impressions > 0 ? Math.round((totals.viewable / totals.impressions) * 1000) / 10 : 0,
    clicks: totals.clicks,
    ctr: totals.impressions > 0 ? Math.round((totals.clicks / totals.impressions) * 10000) / 100 : 0,
    spend_inr: Math.round(totals.spend),
  }

  // Per-campaign rows with derived metrics
  const rows = list.map(c => ({
    id: c.id,
    campaign_name: c.campaign_name,
    status: c.status,
    approval_status: c.approval_status,
    start_date: c.start_date,
    end_date: c.end_date,
    impressions: c.impressions || 0,
    viewable_impressions: c.viewable_impressions || 0,
    viewability_rate: (c.impressions || 0) > 0 ? Math.round(((c.viewable_impressions || 0) / c.impressions) * 1000) / 10 : 0,
    clicks: c.clicks || 0,
    ctr: (c.impressions || 0) > 0 ? Math.round(((c.clicks || 0) / c.impressions) * 10000) / 100 : 0,
    goal: c.target_impressions || c.impressions_cap || null,
    delivered_pct: (c.target_impressions || c.impressions_cap)
      ? Math.min(100, Math.round(((c.impressions || 0) / (c.target_impressions || c.impressions_cap)) * 100))
      : null,
  }))

  return NextResponse.json({ summary, campaigns: rows })
}
