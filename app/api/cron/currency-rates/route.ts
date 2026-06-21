// app/api/cron/currency-rates/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const maxDuration = 60

const CORRIDORS = [
  { base: 'AED', target: 'INR' },
  { base: 'SAR', target: 'INR' },
  { base: 'USD', target: 'INR' },
  { base: 'GBP', target: 'INR' },
  { base: 'QAR', target: 'INR' },
]

const LANGUAGES: Record<string, string> = {
  malayalam: 'Malayalam',
  tamil: 'Tamil',
  hindi: 'Hindi',
  kannada: 'Kannada',
}

// ── FETCH LIVE RATE — free, no API key required ──────────────────
async function fetchRate(base: string, target: string): Promise<number | null> {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`)
    const data = await res.json()
    if (data.result !== 'success') return null
    const rate = data.rates?.[target]
    return typeof rate === 'number' ? rate : null
  } catch {
    return null
  }
}

// ── AI CONTENT GENERATION ─────────────────────────────────────────
async function generateCurrencyContent(
  base: string, target: string, rate: number, prevRate: number, changePct: number,
  langKey: string, geminiKey: string
) {
  const langName = LANGUAGES[langKey] || 'English'
  const direction = changePct > 0.05 ? 'risen' : changePct < -0.05 ? 'fallen' : 'remained largely stable'

  const prompt = `You are a financial content writer for an Indian news platform serving the NRI diaspora.

Write a complete, SEO-optimized article in ${langName} (native script) about today's ${base} to ${target} exchange rate.

DATA (use ONLY these numbers, do not invent any other historical data or statistics):
- Today's rate: 1 ${base} = ${rate.toFixed(2)} ${target}
- Yesterday's rate: 1 ${base} = ${prevRate.toFixed(2)} ${target}
- Change: ${changePct.toFixed(2)}% (the rate has ${direction})

Write entirely in ${langName}:
1. title — engaging headline mentioning ${base} to ${target} and "today"
2. seo_title — under 60 characters
3. meta_description — 150-160 characters with a call to action
4. focus_keyword — 2-4 words, what someone searching would actually type
5. content — 500-600 word article covering: today's rate clearly stated upfront, comparison to yesterday, what this means practically for someone sending money from a ${base}-using country to India, 3-4 practical tips for getting a good remittance rate, brief plain-language context on what generally moves this currency pair, and a short FAQ section with 3 questions or answer about this currency pair.

Add this exact disclaimer line (translated into ${langName}) at the end of the content: "Rates are indicative and sourced from public exchange rate data; please check with your bank or remittance provider for the exact live rate before transferring money."

Return ONLY valid JSON, no markdown:
{"title":"","seo_title":"","meta_description":"","focus_keyword":"","content":""}`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
        }),
      }
    )
    const data = await res.json()
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const cleaned = raw.replace(/```json\n?|```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return null
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

// ── PUSH TO WORDPRESS ──────────────────────────────────────────────
async function pushToWordPress(existingWpPostId: number | null, pageData: any) {
  const base = (process.env.WP_URL || '').replace(/\/$/, '')
  const auth = Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`).toString('base64')
  const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }

  const body = {
    title: pageData.title,
    content: pageData.ai_content,
    slug: pageData.slug,
    status: 'publish',
    meta: {
      _yoast_wpseo_title: pageData.seo_title,
      _yoast_wpseo_metadesc: pageData.meta_description,
      _yoast_wpseo_focuskw: pageData.focus_keyword,
    },
  }

  try {
    const url = existingWpPostId
      ? `${base}/wp-json/wp/v2/posts/${existingWpPostId}`
      : `${base}/wp-json/wp/v2/posts`
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    const text = await res.text()
    if (text.trim().startsWith('<')) {
      return { ok: false, error: `WordPress returned HTML (HTTP ${res.status})` }
    }
    const data = JSON.parse(text)
    if (!res.ok) return { ok: false, error: data.message || 'WP publish failed' }
    return { ok: true, wp_post_id: data.id, wp_url: data.link }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function GET(req: NextRequest) {
  // Basic auth check — set CRON_SECRET in Vercel env vars
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const geminiKey = process.env.GEMINI_API_KEY!
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  const results: any[] = []

  for (const { base, target } of CORRIDORS) {
    const rate = await fetchRate(base, target)
    if (!rate) {
      results.push({ base, target, error: 'Could not fetch rate' })
      continue
    }

    // Save today's rate
    await admin.from('currency_rates').upsert({
      base_currency: base, target_currency: target, rate, rate_date: today,
    }, { onConflict: 'base_currency,target_currency,rate_date' })

    // Get yesterday's rate for trend comparison
    const { data: prevRow } = await admin.from('currency_rates')
      .select('rate').eq('base_currency', base).eq('target_currency', target).eq('rate_date', yesterday).single()
    const prevRate = prevRow?.rate || rate
    const changePct = prevRate > 0 ? ((rate - prevRate) / prevRate) * 100 : 0

    // Generate + publish for each language
    for (const langKey of Object.keys(LANGUAGES)) {
      const slug = `${base.toLowerCase()}-${target.toLowerCase()}-rate-today-${langKey}`

      const { data: existing } = await admin.from('currency_pages')
        .select('id, wp_post_id')
        .eq('base_currency', base).eq('target_currency', target).eq('language', langKey)
        .single()

      const ai = await generateCurrencyContent(base, target, rate, prevRate, changePct, langKey, geminiKey)
      if (!ai || !ai.content) {
        results.push({ base, target, langKey, error: 'AI content generation failed' })
        continue
      }

      const pageData = {
        base_currency: base, target_currency: target, language: langKey, slug,
        title: ai.title, seo_title: ai.seo_title, meta_description: ai.meta_description,
        focus_keyword: ai.focus_keyword, ai_content: ai.content,
        current_rate: rate, previous_rate: prevRate, rate_change_pct: changePct,
        last_updated_at: new Date().toISOString(),
      }

      const wpResult = await pushToWordPress(existing?.wp_post_id || null, pageData)

      const finalData = {
        ...pageData,
        wp_post_id: wpResult.ok ? wpResult.wp_post_id : existing?.wp_post_id,
        wp_url: wpResult.ok ? wpResult.wp_url : undefined,
        status: wpResult.ok ? 'published' : 'pending',
      }

      if (existing) {
        await admin.from('currency_pages').update(finalData).eq('id', existing.id)
      } else {
        await admin.from('currency_pages').insert(finalData)
      }

      results.push({
        base, target, langKey, rate, changePct: changePct.toFixed(2),
        wp_ok: wpResult.ok, wp_url: wpResult.ok ? wpResult.wp_url : wpResult.error,
      })

      // Small delay to be gentle on Gemini + WP API
      await new Promise(r => setTimeout(r, 600))
    }
  }

  const published = results.filter(r => r.wp_ok).length
  const failed = results.filter(r => !r.wp_ok).length

  return NextResponse.json({ total: results.length, published, failed, results })
}
