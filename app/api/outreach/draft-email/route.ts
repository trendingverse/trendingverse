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
  const { data: profile } = await admin
    .from('user_profiles')
    .select('role, company_name')
    .eq('id', user.id)
    .single()

  const isAdmin = user.email === ADMIN_EMAIL
  if (!isAdmin && profile?.role !== 'advertiser') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const geminiKey  = process.env.GEMINI_API_KEY!
  const company    = sender_company || profile?.company_name || 'Our Company'
  const name       = sender_name   || 'Business Development Team'
  const title      = sender_title  || 'Head of Partnerships'

  // Build a detailed campaign brief string
  const cs = campaign_summary || {}
  const campaignDetails = [
    cs.brand         && cs.brand !== 'Brand'  ? `Brand / Advertiser: ${cs.brand}`                : null,
    cs.product                                 ? `Product / Service: ${cs.product || cs.key_message}` : null,
    cs.category      && cs.category !== 'General' ? `Category: ${cs.category}`                   : null,
    cs.target_audience                         ? `Target Audience: ${cs.target_audience}`          : null,
    cs.regions?.length                         ? `Geography: ${Array.isArray(cs.regions) ? cs.regions.join(', ') : cs.regions}` : null,
    cs.budget_range                            ? `Campaign Budget: ${cs.budget_range}`             : null,
    cs.campaign_type                           ? `Deal Type / Format: ${cs.campaign_type}`         : null,
    cs.key_message                             ? `Campaign Goal: ${cs.key_message}`                : null,
    cs.brief                                   ? `Full Brief:\n${cs.brief}`                        : null,
  ].filter(Boolean).join('\n')

  const hasCampaignDetails = campaignDetails.length > 10

  const prompt = `You are ${name}, ${title} at ${company} — a programmatic advertising company.

Write a sharp, specific, direct B2B outreach email to ${publisher.name} (${publisher.site || publisher.site_url}) proposing an advertising partnership.

${hasCampaignDetails ? `ACTIVE CAMPAIGN BRIEF (include these specific details in the email):
${campaignDetails}` : `No specific campaign brief available — write a general partnership introduction.`}

Publisher details:
- Name: ${publisher.name}
- Website: ${publisher.site || publisher.site_url}
- Category: ${publisher.category || 'Digital Publisher'}
- Region: ${publisher.region || 'India'}
- Monthly Audience: ${publisher.monthly_audience || 'Large audience'}

Email writing rules:
1. Subject line must mention the specific product/campaign and publisher name
2. Opening — one sentence max. No "I hope this email finds you well." Get straight to the point.
3. Paragraph 1 — who we are in ONE sentence only. Then immediately pivot to why we're writing.
4. Paragraph 2 — describe the SPECIFIC campaign brief in detail. Include: product, target audience, geography, deal type, creative formats, and integration method. This is the most important paragraph.
5. Paragraph 3 — why ${publisher.name} is the right fit for THIS specific campaign. Be specific about their audience alignment.
6. Paragraph 4 — clear next step. Ask for a 15-minute call to discuss integration and rates.
7. Sign off with name, title, company and contact.

Tone: Direct, professional, B2B advertising industry language. Not salesy. Not generic. Treat the recipient as a media professional.

Total email body: 180-220 words. No fluff.

Format:
Subject: [specific subject line]

[email body]

Best regards,
${name}
${title}
${company}`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
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
