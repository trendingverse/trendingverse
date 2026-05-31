import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@trendingverse.online'

function getWelcomeEmailHtml(name: string, email: string, plan: string) {
  const planDetails: Record<string, { label: string; color: string; articles: string; sites: string; features: string[] }> = {
    free: {
      label: 'Free Plan',
      color: '#6B7280',
      articles: '5 articles/day',
      sites: '1 WordPress site',
      features: ['AI Article Generator', '10 Indian Languages', 'Trending Topics', 'SEO Engine', 'Own API Key Required'],
    },
    popular: {
      label: 'Popular Plan',
      color: '#7C3AED',
      articles: 'Unlimited articles',
      sites: 'Multiple sites',
      features: ['Everything in Free', 'Platform AI Keys', 'Auto-publish Cron', 'Google Search Console', 'Google Analytics 4', 'Priority Support'],
    },
    byoak: {
      label: 'BYOAK Plan',
      color: '#0891B2',
      articles: 'Unlimited articles',
      sites: 'Multiple sites',
      features: ['Everything in Popular', 'Your Own API Keys', 'GPT-4o + Claude + Gemini', 'Lower monthly cost'],
    },
    pro: {
      label: 'Pro Plan',
      color: '#DC2626',
      articles: 'Unlimited articles',
      sites: 'Unlimited sites',
      features: ['Everything included', 'Programmatic Ads', 'Revenue Dashboard', 'Full Admin Access', 'Priority Support'],
    },
  }

  const details = planDetails[plan] || planDetails.free

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to TrendingVerse</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        
        <!-- Header -->
        <tr><td style="background:#111827;border-radius:16px 16px 0 0;padding:32px;text-align:center;">
          <h1 style="margin:0;font-size:28px;color:#fff;font-weight:800;letter-spacing:-0.5px;">
            Trending<span style="color:#EF4444;">Verse</span>
          </h1>
          <p style="margin:8px 0 0;color:#9CA3AF;font-size:14px;">AI-Powered CMS for Publishers</p>
        </td></tr>

        <!-- Welcome Banner -->
        <tr><td style="background:linear-gradient(135deg,#7C3AED,#2563EB);padding:32px;text-align:center;">
          <p style="margin:0 0 8px;color:rgba(255,255,255,0.8);font-size:14px;text-transform:uppercase;letter-spacing:1px;">Welcome aboard!</p>
          <h2 style="margin:0 0 8px;color:#fff;font-size:24px;font-weight:700;">Hey ${name || 'Publisher'} 👋</h2>
          <p style="margin:0;color:rgba(255,255,255,0.85);font-size:16px;">Your TrendingVerse account is ready</p>
        </td></tr>

        <!-- Plan card -->
        <tr><td style="background:#fff;padding:32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background:#F9FAFB;border:2px solid ${details.color};border-radius:12px;padding:24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="background:${details.color};color:#fff;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;text-transform:uppercase;">${details.label}</span>
                    <p style="margin:12px 0 0;color:#111827;font-size:20px;font-weight:700;">Your Plan</p>
                  </td>
                </tr>
                <tr><td style="padding-top:16px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="50%" style="padding:8px 0;">
                        <div style="background:#fff;border-radius:8px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                          <p style="margin:0;font-size:22px;font-weight:800;color:${details.color};">✦</p>
                          <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#111827;">${details.articles}</p>
                          <p style="margin:2px 0 0;font-size:11px;color:#6B7280;">Generation limit</p>
                        </div>
                      </td>
                      <td width="4%"></td>
                      <td width="50%" style="padding:8px 0;">
                        <div style="background:#fff;border-radius:8px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                          <p style="margin:0;font-size:22px;font-weight:800;color:${details.color};">🌐</p>
                          <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#111827;">${details.sites}</p>
                          <p style="margin:2px 0 0;font-size:11px;color:#6B7280;">WordPress sites</p>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </td></tr>

            <!-- Features -->
            <tr><td style="padding-top:24px;">
              <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">What's included</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${details.features.map(f => `
                <tr><td style="padding:6px 0;">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:24px;color:#10B981;font-size:16px;font-weight:700;">✓</td>
                      <td style="font-size:14px;color:#374151;padding-left:8px;">${f}</td>
                    </tr>
                  </table>
                </td></tr>`).join('')}
              </table>
            </td></tr>

            <!-- Getting started steps -->
            <tr><td style="padding-top:28px;">
              <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">Get started in 3 steps</p>
              ${[
                ['1', '#7C3AED', 'Add your API Key', plan === 'free' ? 'Go to Settings → API Keys and add your free Gemini key from aistudio.google.com' : 'Your platform key is ready — no setup needed!'],
                ['2', '#2563EB', 'Generate your first article', 'Go to AI Writer → Enter a topic → Select Kannada or any language → Click Generate'],
                ['3', '#059669', 'Push to WordPress', 'Connect your WordPress site → Click Publish → Your article goes live with SEO meta!'],
              ].map(([num, color, title, desc]) => `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                <tr>
                  <td width="36" valign="top">
                    <div style="width:32px;height:32px;background:${color};border-radius:50%;color:#fff;font-size:14px;font-weight:700;text-align:center;line-height:32px;">${num}</div>
                  </td>
                  <td style="padding-left:12px;">
                    <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${title}</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#6B7280;">${desc}</p>
                  </td>
                </tr>
              </table>`).join('')}
            </td></tr>

            <!-- CTA -->
            <tr><td style="padding-top:28px;text-align:center;">
              <a href="https://trendingverse.vercel.app/admin" 
                style="display:inline-block;background:#EF4444;color:#fff;font-size:16px;font-weight:700;padding:16px 40px;border-radius:12px;text-decoration:none;">
                🚀 Open your dashboard →
              </a>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#F9FAFB;border-radius:0 0 16px 16px;padding:24px;text-align:center;border-top:1px solid #E5E7EB;">
          <p style="margin:0;font-size:13px;color:#6B7280;">You're receiving this because you signed up at <strong>trendingverse.vercel.app</strong></p>
          <p style="margin:8px 0 0;font-size:12px;color:#9CA3AF;">© 2026 TrendingVerse. All rights reserved.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function getAdminNotificationHtml(name: string, email: string, plan: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="500" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <tr><td style="background:#111827;padding:24px;text-align:center;">
          <h2 style="margin:0;color:#fff;font-size:20px;">🔔 New Publisher Signup</h2>
        </td></tr>
        <tr><td style="padding:32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="background:#F0FDF4;border-left:4px solid #10B981;padding:16px;border-radius:8px;margin-bottom:20px;">
              <p style="margin:0;font-size:16px;font-weight:700;color:#065F46;">New publisher just signed up!</p>
            </td></tr>
            <tr><td style="padding-top:20px;">
              ${[
                ['👤 Name', name || 'Not provided'],
                ['📧 Email', email],
                ['📋 Plan', plan.toUpperCase()],
                ['🕐 Time', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST'],
              ].map(([label, value]) => `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                <tr>
                  <td width="120" style="font-size:13px;color:#6B7280;font-weight:600;">${label}</td>
                  <td style="font-size:14px;color:#111827;font-weight:500;">${value}</td>
                </tr>
              </table>`).join('')}
            </td></tr>
            <tr><td style="padding-top:20px;text-align:center;">
              <a href="https://trendingverse.vercel.app/admin/publishers" 
                style="display:inline-block;background:#7C3AED;color:#fff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:10px;text-decoration:none;">
                View in Publishers Panel →
              </a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

async function sendEmail(to: string, subject: string, html: string) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set — email not sent to', to)
    return false
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `TrendingVerse <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  })
  return res.ok
}

export async function POST(req: NextRequest) {
  const { user_id, email, full_name, plan, subject_override, html_override } = await req.json()
if (subject_override && html_override) {
  const sent = await sendEmail(email, subject_override, html_override)
  return NextResponse.json({ success: sent })
}
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const results = await Promise.allSettled([
    // Welcome email to publisher
    sendEmail(
      email,
      '🎉 Welcome to TrendingVerse — Your AI CMS is ready!',
      getWelcomeEmailHtml(full_name || email.split('@')[0], email, plan || 'free')
    ),
    // Admin notification
    sendEmail(
      ADMIN_EMAIL,
      `🔔 New publisher signup: ${full_name || email}`,
      getAdminNotificationHtml(full_name || email.split('@')[0], email, plan || 'free')
    ),
  ])

  return NextResponse.json({
    success: true,
    welcome_sent: results[0].status === 'fulfilled' && results[0].value,
    admin_notified: results[1].status === 'fulfilled' && results[1].value,
  })
}
