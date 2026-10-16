import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data } = await admin.from('direct_ads').select('*').order('created_at', { ascending: false })
  return NextResponse.json(data || [])
}
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const body = await req.json()
  // New campaigns require review before they can serve
  if (!body.approval_status) body.approval_status = 'pending'
  const { data, error } = await admin.from('direct_ads').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { id, ...updates } = await req.json()
  await admin.from('direct_ads').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)

  // Auto-log event when approval_status changes
  if (updates.approval_status) {
    const statusMeta: Record<string, { type: string; desc: string }> = {
      approved:  { type: 'approved',  desc: 'Campaign approved and marked active.' },
      rejected:  { type: 'rejected',  desc: 'Campaign rejected.' },
      paused:    { type: 'paused',    desc: 'Campaign paused by admin.' },
      activated: { type: 'activated', desc: 'Campaign reactivated.' },
      pending:   { type: 'note',      desc: 'Campaign reset to pending review.' },
    }
    const meta = statusMeta[updates.approval_status]
    if (meta) {
      const description = updates.approval_note
        ? `${meta.desc} Note: ${updates.approval_note}`
        : meta.desc
      await admin.from('direct_ad_events').insert({
        ad_id: id,
        event_type: meta.type,
        description,
        metadata: updates.approval_note ? { approval_note: updates.approval_note } : null,
        created_by: user.email,
      }).catch(() => {/* never block response */})
    }
  }

  // Send email notification when approval status changes
  if (updates.approval_status === 'approved' || updates.approval_status === 'rejected') {
    try {
      // Fetch campaign + advertiser details
      const { data: ad } = await admin
        .from('direct_ads')
        .select('campaign_name, advertiser_user_id, approval_note')
        .eq('id', id)
        .maybeSingle()

      if (ad?.advertiser_user_id) {
        const { data: authUser } = await admin.auth.admin.getUserById(ad.advertiser_user_id)
        const advertiserEmail = authUser?.user?.email
        const { data: profile } = await admin
          .from('user_profiles')
          .select('company_name')
          .eq('id', ad.advertiser_user_id)
          .maybeSingle()

        if (advertiserEmail) {
          const isApproved = updates.approval_status === 'approved'
          const campaignName = ad.campaign_name || 'Your campaign'
          const companyName = profile?.company_name || ''
          const note = updates.approval_note || ad.approval_note || ''

          const subject = isApproved
            ? `✅ Campaign approved — ${campaignName} is now live`
            : `❌ Campaign update — ${campaignName}`

          const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="background:#111827;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
          <h1 style="margin:0;font-size:24px;color:#fff;font-weight:800;">Trending<span style="color:#EF4444;">Verse</span></h1>
          <p style="margin:6px 0 0;color:#9CA3AF;font-size:13px;">Advertiser Dashboard</p>
        </td></tr>
        <tr><td style="background:${isApproved ? 'linear-gradient(135deg,#059669,#0891B2)' : 'linear-gradient(135deg,#DC2626,#9333EA)'};padding:28px 32px;text-align:center;">
          <p style="margin:0;font-size:36px;">${isApproved ? '✅' : '📋'}</p>
          <h2 style="margin:12px 0 4px;color:#fff;font-size:20px;font-weight:700;">
            ${isApproved ? 'Campaign Approved!' : 'Campaign Needs Attention'}
          </h2>
          <p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;">
            ${isApproved ? 'Your campaign is now active and serving ads.' : 'Your campaign requires changes before it can go live.'}
          </p>
        </td></tr>
        <tr><td style="background:#fff;padding:32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background:#F9FAFB;border-left:4px solid ${isApproved ? '#059669' : '#DC2626'};border-radius:0 8px 8px 0;padding:16px;margin-bottom:20px;">
              <p style="margin:0 0 4px;font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">Campaign</p>
              <p style="margin:0;font-size:16px;font-weight:700;color:#111827;">${campaignName}</p>
              ${companyName ? `<p style="margin:4px 0 0;font-size:13px;color:#6B7280;">${companyName}</p>` : ''}
            </td></tr>
            ${note ? `
            <tr><td style="padding-top:20px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;">${isApproved ? 'Note from our team:' : 'Reason:'}</p>
              <p style="margin:0;font-size:14px;color:#4B5563;background:#F9FAFB;padding:12px 16px;border-radius:8px;line-height:1.6;">${note}</p>
            </td></tr>` : ''}
            ${isApproved ? `
            <tr><td style="padding-top:24px;">
              <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#374151;">What happens next:</p>
              ${[
                ['📊', 'Track live delivery on your dashboard — impressions and clicks update in real time'],
                ['🎯', 'Use the "Copy pixel" button next to your campaign to set up conversion tracking'],
                ['📋', 'Contact your account manager for any creative or targeting changes'],
              ].map(([icon, text]) => `
              <table cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
                <tr>
                  <td style="width:28px;font-size:16px;">${icon}</td>
                  <td style="font-size:13px;color:#4B5563;padding-left:8px;">${text}</td>
                </tr>
              </table>`).join('')}
            </td></tr>` : `
            <tr><td style="padding-top:24px;">
              <p style="margin:0;font-size:13px;color:#4B5563;">Please reach out to your account manager to discuss the required changes and resubmit your campaign for review.</p>
            </td></tr>`}
            <tr><td style="padding-top:28px;text-align:center;">
              <a href="https://trendingverse.vercel.app/admin"
                style="display:inline-block;background:${isApproved ? '#059669' : '#7C3AED'};color:#fff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;">
                ${isApproved ? '📊 View your dashboard →' : '📧 Contact account manager →'}
              </a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#F9FAFB;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;border-top:1px solid #E5E7EB;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;">© 2026 TrendingVerse · <a href="https://trendingverse.vercel.app" style="color:#6B7280;">trendingverse.online</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

          // Fire-and-forget via the existing email route
          fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://trendingverse.vercel.app'}/api/email/welcome`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: advertiserEmail, subject_override: subject, html_override: html }),
          }).catch(() => {/* silent */})
        }
      }
    } catch {
      // Never let email errors block the approval response
    }
  }

  return NextResponse.json({ success: true })
}
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { searchParams } = new URL(req.url)
  await admin.from('direct_ads').delete().eq('id', searchParams.get('id'))
  return NextResponse.json({ success: true })
}
