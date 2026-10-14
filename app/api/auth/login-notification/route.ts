// app/api/auth/login-notification/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function POST(req: NextRequest) {
  try {
    const { email, name, role } = await req.json()
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

    const now = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

    await resend.emails.send({
      from: 'TrendingVerse CMS <noreply@trendingverse.online>',
      to: email,
      bcc: ADMIN_EMAIL,
      subject: `New login to your TrendingVerse account`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:12px;">
          <div style="background:#fff;border-radius:10px;padding:28px 24px;border:1px solid #e2e8f0;">
            <h2 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Login Alert 🔔</h2>
            <p style="margin:0 0 20px;color:#475569;font-size:14px;">Hi ${name || email}, a new login was detected on your TrendingVerse CMS account.</p>

            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <tr>
                <td style="padding:8px 0;color:#94a3b8;width:100px;">Account</td>
                <td style="padding:8px 0;color:#0f172a;font-weight:600;">${email}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#94a3b8;">Role</td>
                <td style="padding:8px 0;color:#0f172a;font-weight:600;text-transform:capitalize;">${role || 'advertiser'}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#94a3b8;">Time</td>
                <td style="padding:8px 0;color:#0f172a;font-weight:600;">${now} IST</td>
              </tr>
            </table>

            <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;">
              If this wasn't you, please contact us immediately at <a href="mailto:${ADMIN_EMAIL}" style="color:#e63946;">${ADMIN_EMAIL}</a>
            </p>
          </div>
          <p style="text-align:center;margin:16px 0 0;font-size:12px;color:#94a3b8;">TrendingVerse CMS</p>
        </div>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
