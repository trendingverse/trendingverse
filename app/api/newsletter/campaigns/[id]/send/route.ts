import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: campaign } = await supabase.from('newsletter_campaigns').select('*').eq('id', id).single()
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  if (campaign.status === 'sent') return NextResponse.json({ error: 'Already sent' }, { status: 400 })

  const { data: subscribers } = await supabase.from('newsletter_subscribers').select('email,name').eq('is_active', true)
  const count = subscribers?.length || 0

  if (process.env.RESEND_API_KEY && count > 0) {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      for (const sub of (subscribers || [])) {
        await resend.emails.send({
          from: process.env.NEWSLETTER_FROM_EMAIL || 'newsletter@trendingverse.online',
          to: sub.email,
          subject: campaign.subject,
          html: campaign.html_content,
        })
      }
    } catch (e) { console.error('Email send error:', e) }
  }

  const { data: updated } = await supabase.from('newsletter_campaigns')
    .update({ status: 'sent', sent_at: new Date().toISOString(), sent_count: count })
    .eq('id', id).select().single()

  return NextResponse.json(updated)
}
