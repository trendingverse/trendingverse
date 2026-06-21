// app/api/outreach/suggest/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const maxDuration = 30 // allow extra time for site scanning

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

// ── WEBSITE CONTACT SCANNER ──────────────────────────────────────
// Actually fetches the publisher's site and looks for a real email
// in common contact/about/advertise pages, instead of relying on
// the AI to guess one.

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    promise.then(v => { clearTimeout(timer); resolve(v) }).catch(() => { clearTimeout(timer); resolve(fallback) })
  })
}

const JUNK_EMAIL_PATTERNS = [
  'sentry.io', 'wixpress.com', 'example.com', 'yourdomain', 'domain.com',
  'schema.org', 'googleapis.com', 'gstatic.com', 'w3.org', '.png', '.jpg',
  'noreply', 'no-reply', 'wordpress.org', 'gravatar.com', 'cloudflare.com',
  'sentry-next', '@2x', 'placeholder',
]

async function fetchHtml(url: string, timeoutMs = 5000): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrendingVerseBot/1.0; +https://trendingverse.online)' },
      redirect: 'follow',
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const text = await res.text()
    return text.slice(0, 300000) // cap size for safety
  } catch {
    return null
  }
}

function extractEmails(html: string, domainHint: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const matches = html.match(emailRegex) || []
  const cleaned = [...new Set(matches.map(e => e.toLowerCase().trim()))]
    .filter(e => !JUNK_EMAIL_PATTERNS.some(j => e.includes(j)))

  // Prefer emails on the publisher's own domain
  const domainRoot = domainHint.replace(/^www\./, '').split('.')[0]
  const ownDomain = cleaned.filter(e => e.includes(domainRoot))
  return ownDomain.length > 0 ? ownDomain : cleaned
}

async function scanSiteForContact(siteUrl: string): Promise<{ email: string | null; source: string | null }> {
  if (!siteUrl) return { email: null, source: null }
  const base = siteUrl.startsWith('http') ? siteUrl.replace(/\/$/, '') : `https://${siteUrl.replace(/\/$/, '')}`

  let domainHint = ''
  try { domainHint = new URL(base).hostname } catch { domainHint = siteUrl }

  // Priority order — advertise/contact pages first, homepage last
  const paths = ['/advertise', '/advertise-with-us', '/advertising', '/contact', '/contact-us', '/about', '/about-us', '']

  for (const path of paths) {
    const html = await fetchHtml(base + path, 4500)
    if (!html) continue
    const emails = extractEmails(html, domainHint)
    if (emails.length > 0) {
      // Prefer ad-related addresses if multiple found
      const adLike = emails.find(e => /ads?@|advert|sales|partner|media|programmatic/.test(e))
      return { email: adLike || emails[0], source: path || '/' }
    }
  }
  return { email: null, source: null }
}

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

  // Parse brief
  if (!campaign_summary && brief) {
    try {
      const parseRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Extract campaign details from this brief. May be free text, bullets, or table format.

${brief}

Return ONLY valid JSON:
{"brand":"","product":"","category":"","target_audience":"","regions":[],"budget_range":"","campaign_type":"","key_message":"","device":"","deal_type":"","creative_length":"","integration":"","payment_terms":"","kpi":""}

IMPORTANT: 
- Parse tab-separated rows as key:value pairs
- "Geo" field = regions. Expand ALL country codes: MX=Mexico, BD=Bangladesh, IN=India, US=United States, UK=United Kingdom, AE=UAE, SG=Singapore, PH=Philippines, ID=Indonesia, MY=Malaysia, TH=Thailand, VN=Vietnam
- "Vertical" field = category
- "Mode" field = campaign_type and deal_type  
- "KPI" field = key_message and kpi
- "PO" field = budget_range
- Never default regions to India unless brief explicitly says India` }] }],
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

  // Detect signals
  const regions: string[] = Array.isArray(summary.regions) ? summary.regions : [summary.regions || 'India']
  const regionsStr = regions.join(', ').toLowerCase()
  const briefLower = (brief || '').toLowerCase()
  const isBangladesh = regionsStr.includes('bangladesh') || regionsStr.includes('dhaka')
  const isCTV = briefLower.includes('ctv') || briefLower.includes('connected tv') || (summary.device || '').toLowerCase().includes('ctv')
  const isPMP = briefLower.includes('pmp') || (summary.deal_type || '').toLowerCase().includes('pmp')
  const isDV360 = briefLower.includes('dv360') || (summary.integration || '').toLowerCase().includes('dv360')

  const geoContext = isBangladesh
    ? `CRITICAL: Campaign targets Bangladesh/Dhaka. ONLY suggest publishers with real Bangladesh presence:
Hoichoi, Bongo, Chorki, Toffee/BRAC TV, Channel i Digital, NTV Digital, Prothom Alo Digital, Daily Star Bangladesh.
DO NOT suggest JioCinema, Hotstar, SonyLIV, Zee5 — they have no Bangladesh operations.`
    : `Target geography: ${regions.join(', ')}`

  const deviceContext = isCTV
    ? `CTV CAMPAIGN: Only suggest OTT/streaming platforms with Smart TV apps and CTV ad inventory.`
    : ''

  const dealContext = (isPMP || isDV360)
    ? `PMP DEAL: Only suggest publishers supporting programmatic PMP deals${isDV360 ? ' and DV360 integration' : ''}.`
    : ''

  const scope = publisher_scope || 'both'
  const scopeInstruction = scope === 'india' ? 'Indian publishers only.' : scope === 'global' ? 'International publishers only.' : 'Publishers from relevant geography.'

  const prompt = `You are a programmatic media buying expert. Suggest 6 publishers for this campaign.

Campaign: ${JSON.stringify(summary)}
Brief: ${(brief || '').slice(0, 300)}

${geoContext}
${deviceContext}
${dealContext}
${scopeInstruction}

Keep ALL field values SHORT. "why" = max 12 words. "monthly_audience" = format like "5M/mo".

For "contact_email" and "contact_phone": these will be independently verified by scanning each publisher's real website afterward, so just provide your best estimate — do not worry about perfect accuracy here.

Return ONLY a JSON array, no markdown:
[{"name":"","site":"","category":"","region":"","language":"","monthly_audience":"","ctv_available":false,"pmp_supported":false,"contact_email":"","contact_phone":"","why":"","fit_score":85}]`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
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
      return NextResponse.json({ error: 'Could not parse suggestions', raw_preview: raw.slice(0, 300) }, { status: 500 })
    }

    // ── SCAN EACH PUBLISHER'S ACTUAL WEBSITE FOR A REAL CONTACT ──
    // Runs in parallel, capped at 8s per site so total added latency stays bounded.
    const scanResults = await Promise.all(
      suggestions.map((s: any) =>
        withTimeout(scanSiteForContact(s.site || s.site_url || ''), 8000, { email: null, source: null })
      )
    )

    suggestions = suggestions.map((s: any, i: number) => {
      const scan = scanResults[i]
      if (scan.email) {
        return {
          ...s,
          contact_email: scan.email,
          contact_verified: true,
          contact_source: `Found on site (${scan.source})`,
        }
      }
      return {
        ...s,
        contact_verified: false,
        contact_source: 'AI estimate — not found on site, please verify',
      }
    })

    const { data: existingPubs } = await admin.from('publishers_db').select('*').limit(50)
    return NextResponse.json({ summary, suggestions, existing_count: existingPubs?.length || 0 })

  } catch (e) {
    return NextResponse.json({ error: 'Failed', detail: (e as Error).message }, { status: 500 })
  }
}
