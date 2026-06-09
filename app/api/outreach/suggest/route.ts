

// app/api/outreach/suggest/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { brief, campaign_summary, publisher_scope } = body

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const isAdmin = user.email === ADMIN_EMAIL
  const { data: profile } = await admin.from('user_profiles').select('role').eq('id', user.id).single()
  if (!isAdmin && profile?.role !== 'advertiser') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const geminiKey = process.env.GEMINI_API_KEY!
  let summary = campaign_summary || { brand: 'Brand', category: 'General', regions: ['India'] }

  // Parse brief — handles both free-text and tabular (tab/pipe separated) formats
  if (!campaign_summary && brief) {
    try {
      const parseRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Extract ALL campaign details from this brief. The brief may be in free text, bullet points, or a table format (tab/pipe separated columns with headers like Campaign Name, Geo, Vertical, Mode, KPI, Payment Terms etc).

Brief:
${brief}

Return ONLY valid JSON — no markdown, no explanation:
{
  "brand": "campaign/brand name",
  "product": "product or service being advertised",
  "category": "vertical/category (e.g. E-commerce, Fashion, Health, FMCG)",
  "target_audience": "target audience description",
  "regions": ["country or region codes expanded to full names — e.g. MX=Mexico, BD=Bangladesh, IN=India, US=United States"],
  "budget_range": "budget or PO value if mentioned",
  "campaign_type": "deal type or mode (CPA, CPM, PMP, CTV etc)",
  "key_message": "campaign goal or KPI",
  "device": "device type if mentioned (CTV, Mobile, Desktop)",
  "deal_type": "deal type",
  "creative_length": "creative length if mentioned",
  "integration": "integration method if mentioned",
  "payment_terms": "payment terms if mentioned",
  "kpi": "KPI if mentioned",
  "preview_link": "preview link if mentioned"
}

IMPORTANT: For regions/geo, always expand country codes to full country names. MX = Mexico, BD = Bangladesh, IN = India, US = United States, UK = United Kingdom, etc.` }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
          }),
        }
      )
      const pd = await parseRes.json()
      const pt = pd.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const pm = pt.replace(/```json\n?|```/g, '').trim().match(/\{[\s\S]*\}/)
      if (pm) summary = JSON.parse(pm[0])
    } catch { /* use fallback */ }
  }

  // Detect key campaign signals
  const regions: string[] = Array.isArray(summary.regions) ? summary.regions : [summary.regions || 'India']
  const regionsStr = regions.join(', ').toLowerCase()
  const isBangladesh = regionsStr.includes('bangladesh') || regionsStr.includes('dhaka')
  const isCTV = (summary.device || brief || '').toLowerCase().includes('ctv') ||
                (summary.device || brief || '').toLowerCase().includes('connected tv')
  const isPMP = (summary.deal_type || brief || '').toLowerCase().includes('pmp') ||
                (summary.deal_type || brief || '').toLowerCase().includes('private marketplace')
  const isDV360 = (summary.integration || brief || '').toLowerCase().includes('dv360') ||
                  (summary.integration || brief || '').toLowerCase().includes('display & video 360')

  // Build smart geo/device context for Gemini
  const geoContext = isBangladesh
    ? `CRITICAL: This campaign targets Bangladesh (Dhaka). Suggest publishers with ACTUAL Bangladesh audience reach:
       - Prioritize: Hoichoi, Bongo, Chorki, Toffee (BRAC TV), Channel i Digital, NTV Digital, Prothom Alo Digital, Daily Star Bangladesh
       - OTT/streaming platforms with verified Bangladesh user base
       - DO NOT suggest Indian-only platforms like JioCinema, Hotstar, SonyLIV, Zee5 unless they have confirmed Bangladesh operations`
    : `Suggest publishers matching the geographic target: ${regions.join(', ')}`

  const deviceContext = isCTV
    ? `CRITICAL: This is a CTV (Connected TV) campaign. Only suggest publishers/platforms that:
       - Have a Smart TV app or CTV inventory
       - Support video ad formats (pre-roll/mid-roll on TV screens)
       - Support PMP deals for CTV
       - Examples: OTT platforms with TV apps (not mobile-only publishers)`
    : ''

  const dealContext = (isPMP || isDV360)
    ? `Deal type is PMP (Private Marketplace). Only suggest publishers that:
       - Support programmatic PMP deals
       - Are integrated with DSPs${isDV360 ? ', especially DV360' : ''}
       - Have their own SSP integration or work through a rep firm`
    : ''

  const scope = publisher_scope || 'both'
  const scopeInstruction = scope === 'india' ? 'Focus on Indian publishers only.'
    : scope === 'global' ? 'Focus on international publishers.'
    : 'Include publishers from the relevant geography.'

  const prompt = `You are a senior programmatic media buying expert with deep knowledge of publisher inventory globally.

Suggest 6 publishers PERFECTLY suited for this advertising campaign. Be specific and accurate.

Campaign Brief:
${JSON.stringify(summary, null, 2)}

Raw Brief:
${(brief || '').slice(0, 400)}

Geographic Requirements:
${geoContext}

${deviceContext}

${dealContext}

${scopeInstruction}

IMPORTANT RULES:
- Only suggest publishers that ACTUALLY exist and have REAL presence in the target geography
- If CTV campaign, only suggest platforms with actual Smart TV/CTV inventory
- If PMP deal, only suggest publishers that support programmatic buying
- Be specific about WHY each publisher fits this exact campaign
- Include realistic contact details (publisher's partnerships/advertising team email format)

Return ONLY a valid JSON array:
[{
  "name": "Publisher Name",
  "site": "website.com",
  "category": "OTT/News/etc",
  "region": "Bangladesh/India/etc",
  "language": "Bengali/English/etc",
  "monthly_audience": "Xm monthly users",
  "ctv_available": true/false,
  "pmp_supported": true/false,
  "contact_email": "partnerships@publisher.com",
  "contact_phone": "+XX XXXXX XXXXX",
  "why": "Specific reason why this publisher fits this exact campaign",
  "fit_score": 85
}]`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
        }),
      }
    )
    const data = await res.json()
    if (data.error) return NextResponse.json({ error: 'Gemini error: ' + data.error.message }, { status: 500 })

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    let suggestions = null

    try { suggestions = JSON.parse(raw.trim()) } catch { /* try next */ }
    if (!suggestions) {
      const m = raw.match(/\[[\s\S]*\]/)
      if (m) try { suggestions = JSON.parse(m[0]) } catch { /* try next */ }
    }
    if (!suggestions) {
      const cleaned = raw.replace(/```json\n?|```/g, '').trim()
      const m2 = cleaned.match(/\[[\s\S]*\]/)
      if (m2) try { suggestions = JSON.parse(m2[0]) } catch { /* fail */ }
    }

    if (!suggestions || !Array.isArray(suggestions)) {
      return NextResponse.json({ error: 'Could not parse suggestions', raw_preview: raw.slice(0, 200) }, { status: 500 })
    }

    const { data: existingPubs } = await admin.from('publishers_db').select('*').limit(50)
    return NextResponse.json({ summary, suggestions, existing_count: existingPubs?.length || 0 })

  } catch (e) {
    return NextResponse.json({ error: 'Failed', detail: (e as Error).message }, { status: 500 })
  }
}
