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
    .from('user_profiles').select('role, company_name, full_name, designation').eq('id', user.id).single()

  const isAdmin = user.email === ADMIN_EMAIL
  if (!isAdmin && profile?.role !== 'advertiser') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const geminiKey = process.env.GEMINI_API_KEY!

  // ── SENDER IDENTITY ──────────────────────────────────────────
  // Generic by default — only use a personal name/title if explicitly typed into this specific campaign's form.
  // Never auto-pull or invent a name/designation.
  const company = (sender_company && sender_company.trim()) || profile?.company_name || 'our team'
  const name    = (sender_name  && sender_name.trim())  || ''
  const title   = (sender_title && sender_title.trim()) || ''
  const hasPersonalSender = !!name

  const cs = campaign_summary || {}

  // Detect campaign signals for correct terminology
  const rawBrief = cs.brief || cs.campaign_brief || cs.raw_brief || ''
  const dealType = cs.deal_type || cs.campaign_type || ''
  const isCTV    = (cs.device || rawBrief).toLowerCase().includes('ctv') ||
                   (cs.device || rawBrief).toLowerCase().includes('connected tv')
  const isDV360  = (cs.integration || rawBrief).toLowerCase().includes('dv360')
  const regions  = Array.isArray(cs.regions) ? cs.regions.join(', ') : (cs.regions || '')

  // Build structured campaign details block from parsed fields
  const structuredBlock = [
    cs.product || cs.brand        ? `• Product/Brand: ${cs.product || cs.brand}` : null,
    cs.target_audience            ? `• Target Audience: ${cs.target_audience}` : null,
    regions                       ? `• Geography: ${regions}` : null,
    cs.device                     ? `• Device: ${cs.device}` : null,
    cs.creative_length             ? `• Creative Length: ${cs.creative_length}` : null,
    dealType                       ? `• Deal Type: ${dealType}` : null,
    cs.integration                  ? `• Integration: ${cs.integration}` : null,
    cs.budget_range                 ? `• Budget: ${cs.budget_range}` : null,
    cs.key_message                  ? `• Campaign Goal: ${cs.key_message}` : null,
  ].filter(Boolean).join('\n')

  const hasStructured = structuredBlock.length > 20
  const hasRawBrief    = rawBrief.trim().length > 20

  let campaignSection = ''
  if (hasStructured && hasRawBrief) {
    campaignSection = `CAMPAIGN DETAILS (these MUST appear in the email — do not omit or generalize):
${structuredBlock}

ORIGINAL CAMPAIGN BRIEF (use this for any additional context/specifics not captured above):
"""
${rawBrief}
"""`
  } else if (hasStructured) {
    campaignSection = `CAMPAIGN DETAILS (these MUST appear in the email — do not omit or generalize):
${structuredBlock}`
  } else if (hasRawBrief) {
    campaignSection = `CAMPAIGN BRIEF (this MUST be reflected accurately in the email — extract the product, audience, geography, and any deal specifics mentioned and use them directly, do not generalize or invent details not present here):
"""
${rawBrief}
"""`
  } else {
    campaignSection = 'Write a general introduction to explore inventory opportunities. No specific campaign brief was provided.'
  }

  const hasBrief = hasStructured || hasRawBrief

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

  // Signature instructions — strict, no invented designations
  const signatureInstruction = hasPersonalSender
    ? `Sign off using EXACTLY this name and title, verbatim, with no modification, no invented designation:
${name}${title ? '\n' + title : ''}
${company}`
    : `Sign off generically — no personal name, no title, no designation of any kind. Sign off exactly as:
The ${company} Team
Do NOT invent or include any person's name, "Head of X", "Partnerships Team", or any role/designation. Just the company name on its own.`

  const prompt = `You are writing on behalf of ${company} — a programmatic advertising / ad tech company — to pitch a specific advertising campaign to a publisher named ${publisher.name}.

${campaignSection}

${terminologyGuide}

Email structure (strict):
1. Subject — specific: mention product category + deal type if known (e.g. "CTV PMP Opportunity: [Product] Campaign")
2. Line 1 — state why you're writing in ONE sentence. No pleasantries, no "I hope this finds you well".
3. Para 1 (3-4 sentences) — describe the campaign specifically using ONLY the details given above: what the product is, who the target audience is, geography, device type, deal structure. Do not invent details that were not provided. If a detail (e.g. budget) was not given, simply don't mention it — do not guess a number.
4. Para 2 (1-2 sentences MAX) — a brief, generic note on why this kind of inventory fits the campaign. DO NOT cite, repeat, or quote the publisher's own audience size, monthly traffic numbers, or other stats back to them — they already know their own numbers and reciting it back reads as a templated mail-merge. Keep this line about the campaign's fit, not the publisher's profile.
5. Para 3 (1-2 sentences) — next step. Ask for a brief call to share deal ID / tag details.
6. Sign off.

CRITICAL RULES:
- Every campaign-specific claim in the email MUST trace back to the campaign details/brief given above. Never invent product names, budgets, or audience details not mentioned.
- NEVER restate the publisher's own audience size, monthly users, or traffic stats back to them as if informing them of their own numbers.
- No vague filler like "we can help monetize your audience"
- Never wrap brand names, product names, or publisher names in quotation marks — write them as plain proper nouns (e.g. "the Nykaa campaign" not "the 'Nykaa' campaign")
- Total body: 130-160 words
- Tone: confident, peer-to-peer, media industry professional
- If only minimal campaign details are available (e.g. just a brand/region with no specifics), write a SHORTER, more natural 90-110 word email rather than stretching thin details across multiple padded paragraphs. A short, honest email reads more professional than a long one full of filler.

${signatureInstruction}

Format your output exactly as:
Subject: [subject line]

[email body]

Best regards,
[signature block as instructed above]`

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
    return NextResponse.json({ draft, debug: { hasBrief, hasStructured, hasRawBrief, hasPersonalSender, name, title, company, dealType } })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
