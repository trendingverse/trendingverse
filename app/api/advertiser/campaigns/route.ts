import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

export async function POST(req: NextRequest) {
  const userEmail = req.headers.get('x-user-email')
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    brand, campaign_name, vertical, audience, countries,
    format, budget_inr, start_date, end_date,
    landing_url, creative_url, notes,
  } = body

  if (!brand || !vertical) {
    return NextResponse.json({ error: 'brand and vertical required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('direct_ads')
    .insert({
      brand,
      campaign_name: campaign_name || null,
      vertical: vertical || null,
      audience: audience || null,
      countries: countries || [],
      format: format || null,
      budget_inr: budget_inr || null,
      start_date: start_date || null,
      end_date: end_date || null,
      landing_url: landing_url || null,
      creative_url: creative_url || null,
      notes: notes || null,
      approval_status: 'pending',
      advertiser_user_id: userEmail,
      impressions: 0,
      clicks: 0,
      conversions: 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify admin
  fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/email/welcome`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: ADMIN_EMAIL,
      subject_override: `New Campaign Brief: ${brand} — ${campaign_name || vertical}`,
      html_override: `
        <p>A new campaign brief has been submitted via the advertiser dashboard.</p>
        <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
          <tr><td style="padding:4px 12px 4px 0;color:#666">Brand</td><td><strong>${brand}</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Campaign</td><td>${campaign_name || '—'}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Vertical</td><td>${vertical}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Advertiser</td><td>${userEmail}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Budget</td><td>${budget_inr ? '₹' + Number(budget_inr).toLocaleString('en-IN') : '—'}</td></tr>
          ${notes ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Notes</td><td>${notes}</td></tr>` : ''}
        </table>
        <p style="margin-top:16px"><a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/admin" style="background:#6B46C1;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">Review in Admin →</a></p>
      `,
    }),
  }).catch(() => {})

  return NextResponse.json(data, { status: 201 })
}
