import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { computeSeoScore } from '@/lib/seo-scorer'
import { buildArticlePrompt, VALID_CATEGORIES } from '@/lib/article-generation-prompt'
import { computePacing, resolveStatus, computeSpend } from '@/lib/pacing-engine'
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

// VALID_CATEGORIES imported from @/lib/article-generation-prompt

// Determines the correct category from the actual generated content —
// never trust an upstream guess blindly. Falls back to 'World' (never
// leaves a post Uncategorized) if the AI call fails for any reason.
async function determineCategory(title: string, excerpt: string, geminiKey: string): Promise<string> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Categorize this news article into EXACTLY one of these categories: ${VALID_CATEGORIES.join(', ')}.

Title: ${title}
Excerpt: ${excerpt}

Return ONLY the category name, nothing else — no punctuation, no explanation.` }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 20 },
        }),
      }
    )
    const data = await res.json()
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()
    const matched = VALID_CATEGORIES.find(c => c.toLowerCase() === text.toLowerCase())
    return matched || 'World'
  } catch {
    return 'World'
  }
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
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .replace(/^-|-$/g, '') // trim again — slicing to 80 can land exactly on a hyphen,
                            // and WordPress's own slug sanitizer strips that trailing
                            // hyphen on save, which was causing a mismatch with the
                            // slug stored in Supabase.
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

// ── REPLACEMENT for generateArticle() in your cron route ─────────
// Uses Gemini JSON mode + higher token limit + resilient parsing to
// fix the "No JSON in response" / "Expected ',' or '}'" failures.
async function generateArticle(title: string, keywords: string[], category: string, geminiKey: string, language = 'en') {
  const langName = LANGUAGES[language] || 'English'
  const prompt = buildArticlePrompt({ title, category, keywords, language: langName })

  async function callGemini(): Promise<any> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,               // was 4096 — long articles were truncating
            responseMimeType: 'application/json', // force valid JSON, handles escaping internally
          },
        }),
        cache: 'no-store',
      }
    )
    const data = await res.json()
    if (data.error) throw new Error('Gemini error: ' + data.error.message)

    const finishReason = data.candidates?.[0]?.finishReason
    const parts = data.candidates?.[0]?.content?.parts || []
    const text = parts
      .filter((p: { text?: string }) => p.text)
      .map((p: { text: string }) => p.text)
      .join('')
      .replace(/```json\n?|```/g, '')
      .trim()

    if (!text) {
      throw new Error(`Gemini returned empty response${finishReason ? ` (finishReason: ${finishReason})` : ''}`)
    }
    // If the model stopped because it hit the token cap, the JSON is
    // almost certainly truncated — flag it clearly rather than a cryptic parse error.
    if (finishReason === 'MAX_TOKENS') {
      throw new Error('Gemini hit MAX_TOKENS — article too long, JSON truncated. Consider raising maxOutputTokens or shortening the prompt.')
    }

    // Resilient parse: JSON mode returns clean JSON, so a direct parse
    // usually works. Fall back to brace extraction if the model wrapped it.
    try {
      return JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON in response. Raw: ' + text.slice(0, 300))
      return JSON.parse(match[0])   // may still throw — caught by retry wrapper below
    }
  }

  // One retry — transient truncation / malformed output often succeeds second time.
  let article: any
  try {
    article = await callGemini()
  } catch (e) {
    const msg = (e as Error).message
    // Only retry on parse/truncation-type failures, not hard API errors like quota.
    if (/JSON|MAX_TOKENS|Unexpected|Expected/i.test(msg)) {
      await new Promise(r => setTimeout(r, 1500))
      article = await callGemini()   // second attempt; if it throws, it propagates up
    } else {
      throw e
    }
  }

  // Compute algorithmic SEO score and attach to article
  const scoreResult = computeSeoScore({
    title: article.title || title,
    content: article.content || '',
    metaDescription: article.meta_description || '',
    focusKeyword: article.focus_keyword || keywords[0] || '',
    excerpt: article.excerpt || '',
  })
  article.seo_score = scoreResult.total
  article.seo_grade = scoreResult.grade
  article.seo_tips = scoreResult.tips
  return article
}

// ── AI IMAGE GENERATION — replaces Pexels stock photos ───────────
// Generates an original, royalty-free, photorealistic image per article
// instead of reusing stock photography. Never depicts a specific named
// real person's likeness — uses generic/symbolic imagery for those
// stories instead, to avoid any risk of looking like a fabricated photo
// of a real event/person.

async function buildSafeImagePrompt(title: string, excerpt: string, category: string, geminiKey: string): Promise<string> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are writing an image generation prompt for a news article.

Article title: ${title}
Category: ${category}
Excerpt: ${excerpt}

Write a SHORT (2-3 sentence) visual description for a photorealistic editorial photo that illustrates the GENERAL THEME of this article.

CRITICAL RULES:
- NEVER name or describe the specific likeness/face of any real, named, identifiable person (politician, celebrity, athlete, executive, etc.) — even if they are mentioned in the title. Use generic, anonymous, or symbolic imagery instead (e.g. a government building exterior, a podium with a flag, a stadium, a courtroom, a generic crowd seen from behind or at a distance, an object or symbol related to the topic).
- The image must look like a real, natural photograph — not an illustration, cartoon, painting, or surreal/artistic style.
- No text, logos, or watermarks should appear anywhere in the image.
- Keep it tasteful and appropriate for a general news audience.

Return ONLY the visual description, nothing else — no preamble.` }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 200 },
        }),
      }
    )
    const data = await res.json()
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()
    if (text) return text
  } catch { /* fall through to generic fallback */ }

  return `A photorealistic editorial photograph representing the general theme of a ${category} news story. Natural lighting, documentary photography style, no people's faces visible up close, no text or logos.`
}

async function generateAIImage(prompt: string, geminiKey: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const fullPrompt = `${prompt}

Style requirements: photorealistic, natural lighting, professional editorial news photography, documentary style, 16:9 widescreen composition, no text overlays, no logos, no watermarks, no illustrated or cartoon elements, no specific identifiable real people's faces.`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } },
        }),
      }
    )
    const data = await res.json()
    if (data.error) return null
    const parts = data.candidates?.[0]?.content?.parts || []
    const imagePart = parts.find((p: any) => p.inlineData?.data)
    if (!imagePart) return null
    const buffer = Buffer.from(imagePart.inlineData.data, 'base64')
    return { buffer, mimeType: imagePart.inlineData.mimeType || 'image/png' }
  } catch {
    return null
  }
}

// Compress to a lightweight web-friendly JPEG — AI image models return
// large PNGs/high-res files by default; this brings file size down
// dramatically (typically to 60-150KB) without visible quality loss.
async function compressImage(buffer: Buffer): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default
    return await sharp(buffer)
      .resize(1200, 675, { fit: 'cover' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer()
  } catch {
    return buffer // fall back to the original if sharp isn't available
  }
}

async function generateAndUploadAIImage(
  title: string, excerpt: string, category: string, slug: string,
  wpBase: string, auth: string, geminiKey: string, log: string[]
): Promise<number | null> {
  try {
    log.push('Generating original AI image...')
    const safePrompt = await buildSafeImagePrompt(title, excerpt, category, geminiKey)
    const aiImage = await generateAIImage(safePrompt, geminiKey)
    if (!aiImage) { log.push('AI image generation failed — continuing without image'); return null }

    const compressed = await compressImage(aiImage.buffer)
    const filename = `${slug}-ai-${Date.now()}.jpg`
    const uploadRes = await fetch(`${wpBase}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'image/jpeg', 'Content-Disposition': `attachment; filename="${filename}"` },
      body: compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength) as ArrayBuffer,
    })
    if (!uploadRes.ok) { log.push('AI image upload to WordPress failed — continuing without image'); return null }
    const media = await uploadRes.json()
    log.push(`AI image generated & uploaded (ID: ${media.id}, ${(compressed.length / 1024).toFixed(0)}KB)`)
    return media.id
  } catch (e) {
    log.push(`AI image error: ${(e as Error).message} — continuing without image`)
    return null
  }
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
  english: 'English',
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

Write a complete, SEO-optimized article in ${langName} about today's ${base} to ${target} exchange rate.

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

// ── GET OR CREATE WORDPRESS CATEGORY (with optional parent) ──────
async function getOrCreateCategory(wpBase: string, auth: string, name: string, parentId?: number): Promise<number | null> {
  try {
    const searchRes = await fetch(`${wpBase}/wp-json/wp/v2/categories?search=${encodeURIComponent(name)}&per_page=10`, {
      headers: { Authorization: `Basic ${auth}` },
    })
    if (searchRes.ok) {
      const cats = await searchRes.json()
      const existing = cats.find((c: any) =>
        c.name.toLowerCase() === name.toLowerCase() && (parentId === undefined || c.parent === parentId)
      )
      if (existing) return existing.id
    }
    const body: any = { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') }
    if (parentId) body.parent = parentId
    const createRes = await fetch(`${wpBase}/wp-json/wp/v2/categories`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (createRes.ok) {
      const cat = await createRes.json()
      return cat.id || null
    }
  } catch { /* ignore */ }
  return null
}

async function pushCurrencyToWordPress(existingWpPostId: number | null, pageData: any, wpBase: string, auth: string, categoryId?: number | null) {
  const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }
  const body: any = {
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
  if (categoryId) body.categories = [categoryId]
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

  // This feature is exclusive to trendingverse.online — all languages
  // publish to the same site (the WP_URL/auth passed in), not to other publishers.

  // Step 1 — fetch all 5 corridor rates in parallel
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

  // Resolve "Finance → Currency Rates" category once (not per task)
  let currencyCategoryId: number | null = null
  try {
    const financeCatId = await getOrCreateCategory(wpBase, auth, 'Finance')
    currencyCategoryId = await getOrCreateCategory(wpBase, auth, 'Currency Rates', financeCatId || undefined)
    if (currencyCategoryId) log.push(`[currency] Using category ID ${currencyCategoryId} (Finance → Currency Rates)`)
  } catch { log.push('[currency] Category setup failed — publishing without category') }

  // Step 3 — build flat list of (corridor × language) tasks
  type Task = { base: string; target: string; rate: number; prevRate: number; langKey: string }
  const tasks: Task[] = []
  for (const c of corridorData) {
    if (!c.rate) { failed += Object.keys(CURRENCY_LANGUAGES).length; log.push(`[currency] ${c.base}→${c.target}: rate fetch failed`); continue }
    for (const langKey of Object.keys(CURRENCY_LANGUAGES)) {
      tasks.push({ base: c.base, target: c.target, rate: c.rate, prevRate: c.prevRate || c.rate, langKey })
    }
  }

  // Step 4 — run AI generation + WordPress push for all tasks, 4 at a time in parallel
  const taskResults = await mapWithConcurrency(tasks, 4, async (task) => {
    const { base, target, rate, prevRate, langKey } = task
    const changePct = prevRate > 0 ? ((rate - prevRate) / prevRate) * 100 : 0
    const slug = `${base.toLowerCase()}-${target.toLowerCase()}-exchange-rate-today`

    const { data: existing } = await supabase.from('currency_pages')
      .select('id, wp_post_id')
      .eq('base_currency', base).eq('target_currency', target).eq('language', langKey)
      .single()

    const ai = await generateCurrencyContentWithRetry(base, target, rate, prevRate, changePct, langKey, geminiKey)
    if (!ai || !ai.content) {
      return { ok: false, base, langKey, error: ai?.__error || 'AI content generation failed (unknown reason)' }
    }

    const pageData: any = {
      base_currency: base, target_currency: target, language: langKey, slug,
      title: ai.title, seo_title: ai.seo_title, meta_description: ai.meta_description,
      focus_keyword: ai.focus_keyword, ai_content: ai.content,
      current_rate: rate, previous_rate: prevRate, rate_change_pct: changePct,
      last_updated_at: new Date().toISOString(),
    }

    // Always publish to trendingverse.online — never to other publisher sites
    const wpResult = await pushCurrencyToWordPress(existing?.wp_post_id || null, pageData, wpBase, auth, currencyCategoryId)

    pageData.wp_post_id = wpResult.ok ? wpResult.wp_post_id : existing?.wp_post_id
    pageData.wp_url = wpResult.ok ? wpResult.wp_url : undefined
    pageData.status = wpResult.ok ? 'published' : 'pending'

    if (existing) await supabase.from('currency_pages').update(pageData).eq('id', existing.id)
    else await supabase.from('currency_pages').insert(pageData)

    return { ok: wpResult.ok, base, langKey, error: wpResult.ok ? null : wpResult.error }
  })

  for (const r of taskResults) {
    if (r.ok) { updated++; log.push(`[currency] ${r.base}-${r.langKey}: published`) }
    else { failed++; log.push(`[currency] ${r.base}-${r.langKey}: ${r.error}`) }
  }

  return { updated, failed, log }
}

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

    // Run AI image generation and category determination in parallel — independent of each other
    const [wpMediaId, aiCategory] = await Promise.all([
      generateAndUploadAIImage(article.title, article.excerpt || '', trend.category || 'News', slug, wpBase, auth, geminiKey, log),
      determineCategory(article.title, article.excerpt || '', geminiKey),
    ])

    const catId = await getOrCreateCategory(wpBase, auth, aiCategory)
    const categoryIds = catId ? [catId] : []
    log.push(`Category: ${aiCategory}${catId ? '' : ' (could not create — publishing uncategorized)'}`)

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
      wp_post_id: wpData.id,
      category_name: aiCategory,
      seo_score: article.seo_score || null,
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
// ════════════════════════════════════════════════════════════════
// ── DIRECT ADS PACING — runs inside the daily cron ───────────────
// Records per-day delivery, updates spend, and auto-transitions
// campaign status (scheduled→active→completed) + auto-pauses on
// budget spent / goal reached / flight end.
// ════════════════════════════════════════════════════════════════
async function runDirectAdsPacing(supabase: any): Promise<{ processed: number; paused: number; log: string[] }> {
  const log: string[] = []
  let processed = 0, paused = 0
  const today = new Date().toISOString().split('T')[0]

  const { data: campaigns } = await supabase
    .from('direct_ads')
    .select('*')
    .in('status', ['scheduled', 'active', 'paused'])

  if (!campaigns?.length) {
    log.push('[direct-ads] no active campaigns to pace')
    return { processed: 0, paused: 0, log }
  }

  for (const c of campaigns) {
    // Respect manual pauses — the cron never un-pauses an ops decision
    if (c.status === 'paused') continue

    const pacing = computePacing(c)
    const newStatus = resolveStatus(c)
    const spend = computeSpend(c, c.impressions || 0, c.clicks || 0)

    // Per-day delivery ledger: today's numbers = running totals minus prior days
    const { data: priorRows } = await supabase
      .from('direct_ad_daily_delivery')
      .select('impressions, clicks')
      .eq('direct_ad_id', c.id)
      .lt('delivery_date', today)

    const priorImps = (priorRows || []).reduce((s: number, r: any) => s + (r.impressions || 0), 0)
    const priorClicks = (priorRows || []).reduce((s: number, r: any) => s + (r.clicks || 0), 0)
    const todayImps = Math.max(0, (c.impressions || 0) - priorImps)
    const todayClicks = Math.max(0, (c.clicks || 0) - priorClicks)
    const todaySpend = computeSpend(c, todayImps, todayClicks)

    const { data: existingRow } = await supabase
      .from('direct_ad_daily_delivery')
      .select('id')
      .eq('direct_ad_id', c.id)
      .eq('delivery_date', today)
      .single()

    if (existingRow) {
      await supabase.from('direct_ad_daily_delivery')
        .update({ impressions: todayImps, clicks: todayClicks, spend_inr: todaySpend, updated_at: new Date().toISOString() })
        .eq('id', existingRow.id)
    } else {
      await supabase.from('direct_ad_daily_delivery').insert({
        direct_ad_id: c.id, delivery_date: today,
        impressions: todayImps, clicks: todayClicks, spend_inr: todaySpend,
      })
    }

    const updates: any = { spend_inr: spend, last_paced_at: new Date().toISOString() }

    if (pacing.should_pause) {
      updates.status = 'completed'
      updates.is_active = false
      paused++
      log.push(`[direct-ads] ${c.name}: completed — ${pacing.pause_reason}`)
    } else if (newStatus !== c.status) {
      updates.status = newStatus
      updates.is_active = newStatus === 'active'
      log.push(`[direct-ads] ${c.name}: ${c.status} → ${newStatus}`)
    }

    await supabase.from('direct_ads').update(updates).eq('id', c.id)
    processed++
  }

  log.push(`[direct-ads] processed ${processed}, completed ${paused}`)
  return { processed, paused, log }
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
const [articleOutcome, currencyOutcome, pacingOutcome] = await Promise.all([
    runArticlePublish(supabase, geminiKey, pexelsKey, newsApiKey, wpBase, auth, wpUrl, adminUserId, langParam, regionParam),
    runCurrencyRatesUpdate(supabase, geminiKey, wpBase, auth).catch((e) => ({ updated: 0, failed: 0, log: [`Currency rates error: ${(e as Error).message}`] })),
    runDirectAdsPacing(supabase).catch((e) => ({ processed: 0, paused: 0, log: [`Direct-ads pacing error: ${(e as Error).message}`] })),
    fetch(`${new URL(req.url).origin}/api/mediation/revenue/sync?secret=${process.env.CRON_SECRET}`).catch(() => ({})),
  ])

  const log = [...articleOutcome.log, ...currencyOutcome.log, ...pacingOutcome.log]

  return NextResponse.json({
    article: articleOutcome.result,
    currency: { updated: currencyOutcome.updated, failed: currencyOutcome.failed },
    direct_ads: { processed: pacingOutcome.processed, completed: pacingOutcome.paused },
    log,
  })
}
