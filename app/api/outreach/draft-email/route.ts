// app/api/outreach/draft-email/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: profile } = await admin.from('user_profiles').select('role, company_name').eq('id', user.id).single()
  const isAdmin = user.email === ADMIN_EMAIL
  if (!isAdmin && profile?.role !== 'advertiser') return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const { publisher, campaign_summary, sender_company } = await req.json()
  const geminiKey = process.env.GEMINI_API_KEY!
  const company = sender_company || profile?.company_name || 'TrendingVerse'

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Write a professional business development email to approach ${publisher.name} (${publisher.site}) for an advertising partnership.

Campaign: ${JSON.stringify(campaign_summary)}
Publisher: ${JSON.stringify(publisher)}
Sender company: ${company}

Rules:
- Professional but warm tone
- Lead with value for the publisher
- Mention their specific audience relevance
- Include specific campaign details
- Clear call to action
- Keep under 200 words
- No generic filler

Format exactly as:
Subject: [subject line]

[email body]` }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
      }),
    }
  )
  const data = await res.json()
  const draft = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  // Save to outreach log if campaign_id provided
  const { campaign_id, publisher_id } = await req.json().catch(() => ({}))
  if (campaign_id && publisher_id) {
    await admin.from('outreach_log').upsert({
      campaign_id, publisher_id,
      email_draft: draft,
      status: 'drafted',
      created_by: user.id,
    }, { onConflict: 'campaign_id,publisher_id' })
  }

  return NextResponse.json({ draft })
}
