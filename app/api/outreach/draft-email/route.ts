// app/api/outreach/draft-email/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { publisher, campaign_summary, sender_company, sender_name, sender_title } = body

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: profile } = await admin.from('user_profiles').select('role, company_name').eq('id', user.id).single()
  const isAdmin = user.email === ADMIN_EMAIL
  if (!isAdmin && profile?.role !== 'advertiser') return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const geminiKey = process.env.GEMINI_API_KEY!
  const company  = sender_company || profile?.company_name || 'TrendingVerse Ad Network'
  const name     = sender_name || 'Business Development Team'
  const title    = sender_title || 'Head of Partnerships'

  const prompt = `Write a complete, professional business development email to approach ${publisher.name} for an advertising partnership.

Publisher details:
- Name: ${publisher.name}
- Website: ${publisher.site || publisher.site_url}
- Category: ${publisher.category}
- Region: ${publisher.region}
- Monthly Audience: ${publisher.monthly_audience}

Campaign/Advertiser details:
${JSON.stringify(campaign_summary || {})}

Sender:
- Company: ${company}
- Name: ${name}
- Title: ${title}

Write a complete professional email following this structure:
1. Compelling subject line
2. Warm personalized greeting using the publisher name
3. Opening — who we are and why we're reaching out (1-2 sentences)
4. Value proposition — what this partnership offers the publisher specifically (2-3 sentences, mention their audience relevance)
5. Campaign details — what we're advertising, target audience, budget range if provided (2-3 sentences)
6. What we're offering — CPM rates, revenue share, flexible formats (2-3 sentences)
7. Clear call to action — schedule a 15-minute call this week
8. Professional sign-off

Important:
- Be specific to ${publisher.name} and their audience
- Sound human and warm, not templated
- Total length: 200-250 words in the body
- No placeholder text like [Your Name] — use the actual sender details provided

Format exactly as:
Subject: [subject line here]

Dear [Publisher contact name or Team],

[Full email body]

Best regards,
${name}
${title}
${company}`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
        }),
      }
    )
    const data = await res.json()
    const draft = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    if (!draft) return NextResponse.json({ error: 'Email generation failed' }, { status: 500 })
    return NextResponse.json({ draft })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
