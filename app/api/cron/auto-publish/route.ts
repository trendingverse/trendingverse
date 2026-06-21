import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const maxDuration = 300 // Vercel will clamp to your plan's actual max if lower

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

const LANGUAGES: Record<string, string> = {
  'en': 'English',
  'hi': 'Hindi (हिंदी)',
  'ta': 'Tamil (தமிழ்)',
  'te': 'Telugu (తెలుగు)',
  'kn': 'Kannada (ಕನ್ನಡ)',
  'ml': 'Malayalam (മലയാളം)',
  'mr': 'Marathi (मराठी)',
  'gu': 'Gujarati (ગુજરાતી)',
  'bn': 'Bengali (বাংলা)',
  'pa': 'Punjabi (ਪੰਜਾਬੀ)',
}

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  const headerSecret = req.headers.get('authorization')?.replace('Bearer ', '')
  const querySecret = new URL(req.url).searchParams.get('secret')
  return (
    headerSecret === cronSecret ||
    querySecret === cronSecret ||
    req.headers.get('x-vercel-cron') === '1'
  )
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
}

async function getTrendingTopic(geminiKey: string, newsApiKey?: string, region = 'India') {
  if (newsApiKey) {
    try {
      let url = ''
      if (region === 'India') {
        url = `https://newsapi.org/v2/everything?sources=the-times-of-india,the-hindu,ndtv,india-today&pageSize=10&sortBy=publishedAt&apiKey=${newsApiKey}`
      } else if (region === 'UK') {
        url = `https://newsapi.org/v2/top-headlines?country=gb&pageSize=10&apiKey=${newsApiKey}`
      } else {
        url = `https://newsapi.org/v2/top-headlines?country=us&pageSize=10&apiKey=${newsApiKey}`
      }
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        const articles = (data.articles || []).filter((a: { title: string }) =>
          a.title && a.title !== '[Removed]' && a.title.length > 20
        )
        if (articles.length > 0) {
          const pick = articles[Math.floor(Math.random() * Math.min(5, articles.length))]
          const title = pick.title.replace(/ [-|] [^-|]+$/, '').trim()
          return { title, category: 'News', keywords: title.split(' ').filter((w: string) => w.length > 4).slice(0, 5) }
        }
      }
    } catch { /* fallback to Gemini */ }
  }

  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Today is ${today}. What is ONE specific breaking or trending news topic in ${region} right now? Pick from: politics, technology, sports, entertainment, business, health. Return ONLY JSON: {"title":"Specific news headline","category":"Technology","keywords":["kw1","kw2","kw3","kw4","kw5"]}` }] }],
          generationConfig: { temperature: 1 }
        }),
        cache: 'no-store'
      }
    )
    if (res.ok) {
      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        if (parsed.title) return parsed
      }
    }
  } catch { /* final fallback */ }

  const defaults: Record<string, { title: string; category: string; keywords: string[] }> = {
    'India': { title: `India Business and Technology News ${new Date().getFullYear()}`, category: 'Business', keywords: ['india', 'business', 'technology', 'economy', 'news'] },
    'UK': { title: `UK Politics and Economy Update ${new Date().getFullYear()}`, category: 'Politics', keywords: ['uk', 'politics', 'economy', 'britain', 'news'] },
    'US': { title: `US Technology and Business Headlines ${new Date().getFullYear()}`, category: 'Technology', keywords: ['us', 'technology', 'business', 'america', 'news'] },
    'Global': { title: `Global News and World Affairs ${new Date().getFullYear()}`, category: 'World', keywords: ['global', 'world', 'news', 'international', 'affairs'] },
  }
  return defaults[region] || defaults['India']
}

async function generateArticle(title: string, keywords: string[], category: string, geminiKey: string, language = 'en') {
  const langName = LANGUAGES[language] || 'English'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `You are a senior journalist for TrendingVerse news portal.
Write a complete, original, SEO-optimized news article in ${langName}.
Title: ${title}
Category: ${category}
Keywords: ${keywords.join(', ')}
Language: ${langName}
Word count: 700-900 words
Requirements: Professional journalistic tone, E-E-A-T compliant, Google Discover ready, no AI spam patterns, AdSense safe.
Return ONLY valid JSON:
{"title":"Headline in ${langName}","content":"Full HTML article using only p h2 h3 strong em ul li tags","excerpt":"2-3 sentence summary","seo_title":"SEO title 50-60 chars","meta_description":"150-160 chars","focus_keyword":"primary keyword","keywords":["kw1","kw2","kw3"],"reading_time":4}` }]
        }],
        generationConfig: { temperature: 1, maxOutputTokens: 4096 }
      }),
      cache: 'no-store'
    }
  )
  const data = await res.json()
  const parts = data.candidates?.[0]?.content?.parts || []
  const text = parts.filter((p: { text?: string }) => p.text).map((p: { text: string }) => p.text).join('').replace(/```json\n?|```/g, '').trim()
  if (!text) throw new Error('Gemini returned empty response: ' + JSON.stringify(data).slice(0, 200))
  const matches = [...text.matchAll(/\{[\s\S]*?"reading_time"[\s\S]*?\}/g)]
  const jsonStr = matches.length > 0 ? matches[matches.length - 1][0] : text.match(/\{[\s\S]*\}/)?.[0]
  if (!jsonStr) throw new Error('No JSON in response. Raw: ' + text.slice(0, 300))
  return JSON.parse(jsonStr)
}

async function fetchPexelsImage(query: string, pexelsKey: string) {
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape&size=large`,
    { headers: { Authorization: pexelsKey } }
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.photos?.[0] || null
}

async function checkDuplicate(slug: string, title: string, wpBase: string, auth: string): Promise<boolean> {
  const [slugRes, titleRes] = await Promise.all([
    fetch(`${wpBase}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&status=any`, { headers: { Authorization: `Basic ${auth}` } }),
    fetch(`${wpBase}/wp-json/wp/v2/posts?search=${encodeURIComponent(title.slice(0, 30))}&status=any&per_page=5`, { headers: { Authorization: `Basic ${auth}` } }),
  ])
  const slugData = slugRes.ok ? await slugRes.json() : []
  if (Array.isArray(slugData) && slugData.length > 0) return true
  const titleData = titleRes.ok ? await titleRes.json() : []
  if (Array.isArray(titleData)) {
    return titleData.some((p: { title: { rendered: string } }) =>
      p.title.rendered.toLowerCase().trim() === title.toLowerCase().trim()
    )
  }
  return false
}

// ════════════════════════════════════════════════════════════════
// ── CURRENCY RATES MODULE — merged into this cron (Vercel Hobby
// only allows 1 daily cron, so this runs right after the article
// publish step instead of as a separate cron job) ─────────────────
// ════════════════════════════════════════════════════════════════

const CURRENCY_CORRIDORS = [
  { base: 'AED', target: 'INR' },
  { base: 'SAR', target: 'INR' },
  { base: 'USD', target: 'INR' },
  { base: 'GBP', target: 'INR' },
  { base: 'QAR', target: 'INR' },
]

const CURRENCY_LANGUAGES: Record<string, string> = {
  malayalam: 'Malayalam',
  tamil: 'Tamil',
  hindi: 'Hindi',
  kannada: 'Kannada',
}

async function fetchCurrencyRate(base: string, target: string): Promise<number | null> {
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

async function generateCurrencyContent(
  base: string, target: string, rate: number, prevRate: number, changePct: number,
  langKey: string, geminiKey: string
): Promise<{ title?: string; seo_title?: string; meta_description?: string; focus_keyword?: string; content?: string; __error?: string }> {
  const langName = CURRENCY_LANGUAGES[langKey] || 'English'
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
5. content — 500-600 word article covering: today's rate clearly stated upfront, comparison to yesterday, what this means practically for someone sending money from a ${base}-using country to India, 3-4 practical tips for getting a good remittance rate, brief plain-language context on what generally moves this currency pair, and a short FAQ section with 3 questions and answers about this currency pair.

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
    if (data.error) {
      return { __error: `Gemini API error (${data.error.code || res.status}): ${data.error.message || JSON.stringify(data.error).slice(0, 150)}` }
    }
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    if (!raw) {
      const finishReason = data.candidates?.[0]?.finishReason
      return { __error: `Empty response from Gemini${finishReason ? ` (finishReason: ${finishReason})` : ''}` }
    }
    const cleaned = raw.replace(/```json\n?|```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return { __error: 'No JSON found in Gemini response: ' + raw.slice(0, 120) }
    const parsed = JSON.parse(match[0])
    if (!parsed.content) return { __error: 'Parsed JSON missing content field' }
    return parsed
  } catch (e) {
    return { __error: `Request failed: ${(e as Error).message}` }
  }
}

// Retry wrapper — transient rate-limit/network errors often succeed on retry
async function generateCurrencyContentWithRetry(
  base: string, target: string, rate: number, prevRate: number, changePct: number,
  langKey: string, geminiKey: string, maxRetries = 2
): Promise<{ title?: string; seo_title?: string; meta_description?: string; focus_keyword?: string; content?: string; __error?: string }> {
  let lastError = 'Unknown error'
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await generateCurrencyContent(base, target, rate, prevRate, changePct, langKey, geminiKey)
    if (result && !result.__error && result.content) return result
    lastError = result.__error || 'AI returned no content'
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 1200 * (attempt + 1))) // 1.2s, then 2.4s backoff
    }
  }
  return { __error: lastError }
}

async function pushCurrencyToWordPress(existingWpPostId: number | null, pageData: any, wpBase: string, auth: string) {
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
      ? `${wpBase}/wp-json/wp/v2/posts/${existingWpPostId}`
      : `${wpBase}/wp-json/wp/v2/posts`
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    const text = await res.text()
    if (text.trim().startsWith('<')) return { ok: false, error: `WordPress returned HTML (HTTP ${res.status})` }
    const data = JSON.parse(text)
    if (!res.ok) return { ok: false, error: data.message || 'WP publish failed' }
    return { ok: true, wp_post_id: data.id, wp_url: data.link }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

// ── Concurrency-limited parallel executor ──────────────────────
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const current = idx++
      results[current] = await fn(items[current])
    }
  }
  const workers = Array(Math.min(limit, items.length)).fill(0).map(() => worker())
  await Promise.all(workers)
  return results
}

async function runCurrencyRatesUpdate(
  supabase: any, geminiKey: string, wpBase: string, auth: string
): Promise<{ updated: number; failed: number; log: string[] }> {
  const log: string[] = []
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  let updated = 0, failed = 0

  // Step 1 — fetch all 5 corridor rates in parallel (fast HTTP calls, no AI)
  const corridorRates = await Promise.all(
    CURRENCY_CORRIDORS.map(async (c) => {
      const rate = await fetchCurrencyRate(c.base, c.target)
      return { ...c, rate }
    })
  )

  // Step 2 — upsert today's rate + fetch yesterday's rate, in parallel
  const corridorData = await Promise.all(
    corridorRates.map(async ({ base, target, rate }) => {
      if (!rate) return { base, target, rate: null as number | null, prevRate: null as number | null }
      await supabase.from('currency_rates').upsert({
        base_currency: base, target_currency: target, rate, rate_date: today,
      }, { onConflict: 'base_currency,target_currency,rate_date' })
      const { data: prevRow } = await supabase.from('currency_rates')
        .select('rate').eq('base_currency', base).eq('target_currency', target).eq('rate_date', yesterday).single()
      const prevRate = prevRow?.rate || rate
      return { base, target, rate, prevRate }
    })
  )

  // Step 3 — build flat list of (corridor × language) tasks
  type Task = { base: string; target: string; rate: number; prevRate: number; langKey: string }
  const tasks: Task[] = []
  for (const c of corridorData) {
    if (!c.rate) { failed += Object.keys(CURRENCY_LANGUAGES).length; log.push(`[currency] ${c.base}→${c.target}: rate fetch failed`); continue }
    for (const langKey of Object.keys(CURRENCY_LANGUAGES)) {
      tasks.push({ base: c.base, target: c.target, rate: c.rate, prevRate: c.prevRate || c.rate, langKey })
    }
  }

  // Step 4 — run AI generation + WordPress push for all tasks, 5 at a time in parallel
  const taskResults = await mapWithConcurrency(tasks, 4, async (task) => {
    const { base, target, rate, prevRate, langKey } = task
    const changePct = prevRate > 0 ? ((rate - prevRate) / prevRate) * 100 : 0
    const slug = `${base.toLowerCase()}-${target.toLowerCase()}-rate-today-${langKey}`

    const { data: existing } = await supabase.from('currency_pages')
      .select('id, wp_post_id')
      .eq('base_currency', base).eq('target_currency', target).eq('language', langKey)
      .single()

    const ai = await generateCurrencyContentWithRetry(base, target, rate, prevRate, changePct, langKey, geminiKey)
    if (!ai || !ai.content) {
      return { ok: false, base, langKey, error: ai?.__error || 'AI content generation failed (unknown reason)' }
    }

    const pageData = {
      base_currency: base, target_currency: target, language: langKey, slug,
      title: ai.title, seo_title: ai.seo_title, meta_description: ai.meta_description,
      focus_keyword: ai.focus_keyword, ai_content: ai.content,
      current_rate: rate, previous_rate: prevRate, rate_change_pct: changePct,
      last_updated_at: new Date().toISOString(),
    }

    const wpResult = await pushCurrencyToWordPress(existing?.wp_post_id || null, pageData, wpBase, auth)

    const finalData = {
      ...pageData,
      wp_post_id: wpResult.ok ? wpResult.wp_post_id : existing?.wp_post_id,
      wp_url: wpResult.ok ? wpResult.wp_url : undefined,
      status: wpResult.ok ? 'published' : 'pending',
    }

    if (existing) await supabase.from('currency_pages').update(finalData).eq('id', existing.id)
    else await supabase.from('currency_pages').insert(finalData)

    return { ok: wpResult.ok, base, langKey, error: wpResult.ok ? null : wpResult.error }
  })

  for (const r of taskResults) {
    if (r.ok) { updated++; log.push(`[currency] ${r.base}-${r.langKey}: published`) }
    else { failed++; log.push(`[currency] ${r.base}-${r.langKey}: ${r.error}`) }
  }

  return { updated, failed, log }
}

// ════════════════════════════════════════════════════════════════
// ── MAIN CRON HANDLER ──────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════

async function runArticlePublish(
  supabase: any, geminiKey: string, pexelsKey: string | undefined, newsApiKey: string | undefined,
  wpBase: string, auth: string, wpUrl: string, adminUserId: string | null, langParam: string, regionParam: string
): Promise<{ result: any; log: string[] }> {
  const log: string[] = []
  try {
    log.push(`Starting auto-publish | lang: ${langParam} | region: ${regionParam}`)
    log.push('Fetching trending topic...')
    const trend = await getTrendingTopic(geminiKey, newsApiKey, regionParam)
    log.push(`Topic: ${trend.title}`)

    const slug = slugify(trend.title)
    const isDuplicate = await checkDuplicate(slug, trend.title, wpBase, auth)
    if (isDuplicate) {
      log.push(`Duplicate detected — skipping`)
      await supabase.from('cron_logs').insert({ status: 'skipped', title: trend.title, wp_url: wpUrl, log, user_id: adminUserId })
      return { result: { success: false, skipped: true, reason: 'duplicate' }, log }
    }

    log.push(`Generating article in ${LANGUAGES[langParam] || 'English'}...`)
    const article = await generateArticle(trend.title, trend.keywords, trend.category, geminiKey, langParam)
    log.push(`Article: ${article.title}`)

    let wpMediaId: number | null = null
    if (pexelsKey) {
      log.push('Fetching photo from Pexels...')
      const photo = await fetchPexelsImage(trend.keywords.slice(0, 2).join(' '), pexelsKey)
      if (photo) {
        try {
          const imgRes = await fetch(photo.src.large || photo.src.original)
          if (imgRes.ok) {
            const imgBuffer = Buffer.from(await imgRes.arrayBuffer())
            const filename = `${slug}-${Date.now()}.jpg`
            const uploadRes = await fetch(`${wpBase}/wp-json/wp/v2/media`, {
              method: 'POST',
              headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'image/jpeg', 'Content-Disposition': `attachment; filename="${filename}"` },
              body: imgBuffer,
            })
            if (uploadRes.ok) {
              const media = await uploadRes.json()
              wpMediaId = media.id
              log.push(`Photo uploaded (ID: ${wpMediaId})`)
            }
          }
        } catch { log.push('Photo upload failed — continuing') }
      }
    }

    const catRes = await fetch(`${wpBase}/wp-json/wp/v2/categories?per_page=100`, { headers: { Authorization: `Basic ${auth}` } })
    const wpCats = catRes.ok ? await catRes.json() : []
    const matched = wpCats.find((c: { name: string }) => c.name.toLowerCase() === (trend.category || 'news').toLowerCase())
    const categoryIds = matched ? [matched.id] : []

    log.push('Publishing to WordPress...')
    const wpRes = await fetch(`${wpBase}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        title: article.title,
        content: article.content,
        excerpt: article.excerpt,
        status: 'publish',
        slug: slugify(article.title),
        categories: categoryIds,
        ...(wpMediaId ? { featured_media: wpMediaId } : {}),
        meta: {
          _yoast_wpseo_title: article.seo_title || article.title,
          _yoast_wpseo_metadesc: article.meta_description || '',
          _yoast_wpseo_focuskw: article.focus_keyword || '',
        }
      }),
    })
    const wpData = await wpRes.json()
    if (!wpRes.ok) throw new Error(wpData.message || 'WordPress publish failed')
    log.push(`Published: ${wpData.link}`)

    await supabase.from('articles').insert({
      title: article.title,
      slug: slugify(article.title),
      content: article.content,
      excerpt: article.excerpt,
      seo_title: article.seo_title,
      meta_description: article.meta_description,
      focus_keyword: article.focus_keyword,
      keywords: article.keywords || [],
      status: 'published',
      ai_generated: true,
      source: 'cron',
      user_id: adminUserId,
      author_name: 'TrendingVerse AI',
      word_count: (article.content || '').replace(/<[^>]+>/g, '').split(' ').length,
      reading_time_min: article.reading_time || 4,
      published_at: new Date().toISOString(),
    })

    await supabase.from('cron_logs').insert({
      status: 'success', title: article.title, wp_url: wpData.link, log, user_id: adminUserId,
    })

    return { result: { success: true, title: article.title, wp_url: wpData.link, wp_post_id: wpData.id, language: LANGUAGES[langParam] }, log }
  } catch (e) {
    log.push(`Error: ${(e as Error).message}`)
    try {
      await supabase.from('cron_logs').insert({ status: 'failed', error: (e as Error).message, wp_url: wpUrl, log, user_id: adminUserId })
    } catch { /* ignore log errors */ }
    return { result: { success: false, error: (e as Error).message }, log }
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const geminiKey = process.env.GEMINI_CRON_KEY || process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY
  const pexelsKey = process.env.PEXELS_API_KEY
  const newsApiKey = process.env.NEWS_API_KEY
  const wpUrl = process.env.WP_URL
  const wpUsername = process.env.WP_USERNAME
  const wpPassword = process.env.WP_APP_PASSWORD

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: { users } } = await supabase.auth.admin.listUsers()
  const adminUserId = users?.find(u => u.email === ADMIN_EMAIL)?.id || null

  const url = new URL(req.url)
  const langParam = url.searchParams.get('lang') || 'en'
  const regionParam = url.searchParams.get('region') || 'India'

  if (!geminiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 })
  if (!wpUrl || !wpUsername || !wpPassword) return NextResponse.json({ error: 'WordPress credentials not set' }, { status: 500 })

  const wpBase = wpUrl.replace(/\/$/, '')
  const auth = Buffer.from(`${wpUsername}:${wpPassword}`).toString('base64')

  // ── Run article publishing AND currency rates update CONCURRENTLY ──
  // (previously sequential — total time was article_time + currency_time;
  // now it's max(article_time, currency_time), roughly halving wall-clock time)
  const [articleOutcome, currencyOutcome] = await Promise.all([
    runArticlePublish(supabase, geminiKey, pexelsKey, newsApiKey, wpBase, auth, wpUrl, adminUserId, langParam, regionParam),
    runCurrencyRatesUpdate(supabase, geminiKey, wpBase, auth).catch((e) => ({ updated: 0, failed: 0, log: [`Currency rates error: ${(e as Error).message}`] })),
  ])

  const log = [...articleOutcome.log, ...currencyOutcome.log]

  return NextResponse.json({
    article: articleOutcome.result,
    currency: { updated: currencyOutcome.updated, failed: currencyOutcome.failed },
    log,
  })
}
