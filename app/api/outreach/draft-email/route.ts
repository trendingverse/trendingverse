// app/api/outreach/draft-email/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { publisher, campaign_summary, sender_name, sender_title, sender_company } = body

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: profile } = await admin
    .from('user_profiles').select('role, company_name').eq('id', user.id).single()

  const isAdmin = user.email === ADMIN_EMAIL
  if (!isAdmin && profile?.role !== 'advertiser') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const geminiKey = process.env.GEMINI_API_KEY!
  const company   = sender_company || profile?.company_name || 'AdCandid'
  const name      = sender_name || 'Business Development Team'
  const title     = sender_title || 'Head of Partnerships'

  const cs = campaign_summary || {}

  // Detect campaign signals for correct terminology
  const isCTV    = (cs.device || cs.brief || '').toLowerCase().includes('ctv') ||
                   (cs.device || cs.brief || '').toLowerCase().includes('connected tv')
  const isPMP    = (cs.deal_type || cs.brief || '').toLowerCase().includes('pmp')
  const isDV360  = (cs.integration || cs.brief || '').toLowerCase().includes('dv360')
  const regions  = Array.isArray(cs.regions) ? cs.regions.join(', ') : (cs.regions || 'the target region')

  // Build structured campaign details block
  const campaignBlock = [
    cs.product || cs.brand      ? `• Product/Brand: ${cs.product || cs.brand}` : null,
    cs.target_audience           ? `• Target Audience: ${cs.target_audience}` : null,
    regions                      ? `• Geography: ${regions}` : null,
    cs.device                    ? `• Device: ${cs.device}` : null,
    cs.creative_length           ? `• Creative Length: ${cs.creative_length}` : null,
    cs.deal_type                 ? `• Deal Type: ${cs.deal_type}` : null,
    cs.integration               ? `• Integration: ${cs.integration}` : null,
    cs.budget_range              ? `• Budget: ${cs.budget_range}` : null,
    cs.key_message               ? `• Campaign Goal: ${cs.key_message}` : null,
  ].filter(Boolean).join('\n')

  const hasBrief = campaignBlock.length > 20

  // CTV-specific terminology guide
  const terminologyGuide = isCTV ? `
Use correct CTV/programmatic terminology:
- Say "CTV inventory" not "display placements"
- Say "video creatives (${cs.creative_length || '15/30 sec'})" not just "ads"
- Say "PMP deal ID" or "private deal" not "partnership"
- Say "impressions" and "CPM" not generic "ads"
- Mention DV360 or DSP integration specifically${isDV360 ? ' — they use DV360' : ''}
- Reference "brand safety" and "viewability" as CTV strengths` : `
Use standard digital advertising terminology appropriate for this publisher type.`

  const prompt = `You are ${name}, ${title} at ${company} — a programmatic advertising / ad tech company.

Write a concise, sharp B2B outreach email to ${publisher.name} proposing a specific advertising campaign.

Publisher:
- Name: ${publisher.name}
- Website: ${publisher.site || publisher.site_url}
- Audience: ${publisher.monthly_audience || 'large audience'}
- Region: ${publisher.region || 'relevant market'}
- Category: ${publisher.category || 'digital publisher'}

${hasBrief ? `CAMPAIGN DETAILS (these MUST appear in the email — do not omit or generalize):
${campaignBlock}` : 'Write a general introduction to explore inventory opportunities.'}

${terminologyGuide}

Email structure (strict):
1. Subject — specific: mention product category + publisher name + deal type (e.g. "CTV PMP Opportunity: Sanitary Care Campaign for [Publisher]")
2. Line 1 — state who you are and why you're writing in ONE sentence. No pleasantries.
3. Para 1 (3-4 sentences) — describe the campaign specifically: what the product is, who the target audience is, geography, device type, deal structure. This is the pitch.
4. Para 2 (2-3 sentences) — why THIS publisher is the right fit for this specific campaign. Reference their actual audience/geography.
5. Para 3 (1-2 sentences) — next step. Ask for a brief call to share deal ID / tag details.
6. Sign off.

Rules:
- No "I hope this email finds you well" or any filler opener
- No vague statements like "we can help monetize your audience"
- Every sentence must be specific to this campaign and this publisher
- Total body: 150-180 words
- Tone: confident, peer-to-peer, media industry professional

Format:
Subject: [subject line]

[email body]

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
