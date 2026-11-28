export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { computeSeoScore } from '@/lib/seo-scorer'
import { buildArticlePrompt, VALID_CATEGORIES, type ArticleSource } from '@/lib/article-generation-prompt'
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiKey}`,
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

// ── REAL-SOURCE TOPIC DISCOVERY ──────────────────────────────────
// Every auto-published article must be based on a real story from a real
// publisher, published in the last 36 hours. There is NO fallback to
// AI-invented headlines or hardcoded evergreen titles: if no fresh real
// story is available, the run is skipped. (The old fallbacks produced
// fabricated "breaking news" and hundreds of near-duplicate posts.)
export interface SourcedTopic {
  title: string
  category: string
  keywords: string[]
  source: ArticleSource
}

const MAX_SOURCE_AGE_MS = 36 * 60 * 60 * 1000

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function keywordsFrom(title: string): string[] {
  const stop = new Set(['about', 'after', 'their', 'there', 'which', 'would', 'could', 'should', 'these', 'those', 'where', 'while', 'with', 'from', 'into', 'over', 'says', 'said'])
  return title.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter(w => w.length > 4 && !stop.has(w)).slice(0, 5)
}

async function fromNewsApi(newsApiKey: string, region: string): Promise<SourcedTopic[]> {
  let url = ''
  if (region === 'India') {
    url = `https://newsapi.org/v2/everything?sources=the-times-of-india,the-hindu,ndtv,india-today&pageSize=20&sortBy=publishedAt&apiKey=${newsApiKey}`
  } else if (region === 'GCC') {
    url = `https://newsapi.org/v2/top-headlines?sources=al-jazeera-english&pageSize=20&apiKey=${newsApiKey}`
  } else if (region === 'UK') {
    url = `https://newsapi.org/v2/top-headlines?country=gb&pageSize=20&apiKey=${newsApiKey}`
  } else {
    url = `https://newsapi.org/v2/top-headlines?country=us&pageSize=20&apiKey=${newsApiKey}`
  }
  const res = await fetch(url, {})
  if (!res.ok) return []
  const data = await res.json()
  const now = Date.now()
  return (data.articles || [])
    .filter((a: any) => a.title && a.title !== '[Removed]' && a.title.length > 20 && a.url)
    .filter((a: any) => !a.publishedAt || now - new Date(a.publishedAt).getTime() < MAX_SOURCE_AGE_MS)
    .map((a: any) => {
      const title = a.title.replace(/ [-|] [^-|]+$/, '').trim()
      return {
        title,
        category: 'News',
        keywords: keywordsFrom(title),
        source: {
          title,
          url: a.url,
          publisher: a.source?.name || new URL(a.url).hostname.replace(/^www\./, ''),
          description: a.description || '',
          publishedAt: a.publishedAt || undefined,
        },
      }
    })
}

// Google News RSS — free, no key. Used when NEWS_API_KEY is missing or empty.
async function fromGoogleNews(region: string): Promise<SourcedTopic[]> {
  const ed: Record<string, string> = {
    India: 'hl=en-IN&gl=IN&ceid=IN:en',
    GCC: 'hl=en-AE&gl=AE&ceid=AE:en',
    UK: 'hl=en-GB&gl=GB&ceid=GB:en',
    USA: 'hl=en-US&gl=US&ceid=US:en',
  }
  const res = await fetch(`https://news.google.com/rss?${ed[region] || ed.India}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrendingVerseBot/1.0)' },
  })
  if (!res.ok) return []
  const xml = await res.text()
  const now = Date.now()
  const items = xml.split('<item>').slice(1).map(chunk => chunk.split('</item>')[0])
  const out: SourcedTopic[] = []
  for (const it of items) {
    const get = (tag: string) => (it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1] || ''
    const rawTitle = decodeEntities(get('title'))
    const link = decodeEntities(get('link'))
    const pubDate = get('pubDate')
    const publisher = decodeEntities(get('source')) || ''
    if (!rawTitle || !link || rawTitle.length < 20) continue
    if (pubDate && now - new Date(pubDate).getTime() > MAX_SOURCE_AGE_MS) continue
    const suffix = publisher ? ` - ${publisher}` : ''
    const title = suffix && rawTitle.endsWith(suffix) ? rawTitle.slice(0, -suffix.length).trim() : rawTitle
    out.push({
      title,
      category: 'News',
      keywords: keywordsFrom(title),
      source: {
        title,
        url: link,
        publisher: publisher || 'Google News',
        description: decodeEntities(get('description')).slice(0, 600),
        publishedAt: pubDate ? new Date(pubDate).toISOString() : undefined,
      },
    })
  }
  return out
}

async function getSourcedTopics(newsApiKey: string | undefined, region = 'India'): Promise<SourcedTopic[]> {
  let topics: SourcedTopic[] = []
  if (newsApiKey) {
    try { topics = await fromNewsApi(newsApiKey, region) } catch { /* try Google News */ }
  }
  if (topics.length === 0) {
    try { topics = await fromGoogleNews(region) } catch { /* nothing available */ }
  }
  // Light shuffle of the top 10 so consecutive runs don't always pick item #1
  const head = topics.slice(0, 10).sort(() => Math.random() - 0.5)
  return [...head, ...topics.slice(10)]
}

// ── REPLACEMENT for generateArticle() in your cron route ─────────
// Uses Groq JSON mode + higher token limit + resilient parsing to
// fix the "No JSON in response" / "Expected ',' or '}'" failures.
async function generateArticle(title: string, keywords: string[], category: string, geminiKey: string, language = 'en', region = 'India', source?: ArticleSource) {
  const langName = LANGUAGES[language] || 'English'
  const prompt = buildArticlePrompt({ title, category, keywords, language: langName, region, source })

  async function callGroq(): Promise<any> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
        }),
        
      }
    )
    const data = await res.json()
    if (data.error) throw new Error('Gemini error: ' + data.error.message)

    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '')
      .replace(/```json\n?|```/g, '')
      .trim()

    if (!text) {
      throw new Error('Groq returned empty response')
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
    article = await callGroq()
  } catch (e) {
    const msg = (e as Error).message
    // Only retry on parse/truncation-type failures, not hard API errors like quota.
    if (/JSON|MAX_TOKENS|Unexpected|Expected/i.test(msg)) {
      await new Promise(r => setTimeout(r, 1500))
      article = await callGroq()   // second attempt; if it throws, it propagates up
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiKey}`,
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

// Fetch a relevant image from Pexels (free, 1200px+ for Google Discover)
// usedIds: photo IDs already used in this cron run — skip them to prevent duplicate images
async function generateAIImage(_prompt: string, _key: string, pexelsKey?: string, keywords?: string[], category?: string, usedIds: Set<number> = new Set()): Promise<{ buffer: Buffer; mimeType: string; photoId: number } | null> {
  if (!pexelsKey || !keywords?.length) return null
  try {
    // Build a visually distinctive query: use category + ONE strong keyword rather than pasting all keywords
    // This avoids "newspaper" or "chart" images dominating business topics
    const categoryVisuals: Record<string, string> = {
      Business: 'office cityscape finance',
      Technology: 'technology digital innovation',
      Politics: 'government parliament flag',
      Health: 'hospital healthcare medical',
      Sports: 'stadium sports crowd',
      Entertainment: 'entertainment stage performance',
      Education: 'university campus students',
      Lifestyle: 'lifestyle city people',
      Environment: 'nature environment landscape',
      World: 'world global city aerial',
    }
    const catQuery = categoryVisuals[category || ''] || ''
    const topKw = keywords.find(k => k.length > 5 && !['report', 'trend', 'update', 'latest', 'news'].includes(k.toLowerCase())) || keywords[0]
    const query = catQuery ? `${topKw} ${catQuery}` : keywords.slice(0, 2).join(' ')

    // Randomise Pexels page (1-4) to avoid always getting the same first-page results
    const page = Math.floor(Math.random() * 4) + 1
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&page=${page}&orientation=landscape&size=large`,
      { headers: { Authorization: pexelsKey } }
    )
    if (!res.ok) return null
    const data = await res.json()
    let photos: any[] = data.photos || []
    // Filter out already-used photos in this run
    photos = photos.filter((p: any) => !usedIds.has(p.id))
    if (!photos.length) {
      // Fallback: page 1 without used-ID filter as last resort
      const r2 = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(catQuery || topKw)}&per_page=15&orientation=landscape&size=large`, { headers: { Authorization: pexelsKey } })
      if (!r2.ok) return null
      const d2 = await r2.json()
      photos = (d2.photos || []).filter((p: any) => !usedIds.has(p.id))
      if (!photos.length) return null
    }
    // Pick randomly from results for variety
    const photo = photos[Math.floor(Math.random() * Math.min(8, photos.length))]
    // large2x is 1200px+ wide — required for Google Discover eligibility
    const imgUrl = photo.src?.large2x || photo.src?.large || photo.src?.medium
    if (!imgUrl) return null
    const imgRes = await fetch(imgUrl)
    if (!imgRes.ok) return null
    const buffer = Buffer.from(await imgRes.arrayBuffer())
    return { buffer, mimeType: 'image/jpeg', photoId: photo.id }
  } catch {
    return null
  }
}

// Compress to a lightweight web-friendly JPEG — sharp is not available
// in Edge runtime, so we pass the buffer through as-is. AI images are
// typically <2MB and WordPress handles resizing server-side.
async function compressImage(buffer: Buffer): Promise<Buffer> {
  return buffer
}

async function generateAndUploadAIImage(
  title: string, excerpt: string, category: string, slug: string,
  wpBase: string, auth: string, geminiKey: string, log: string[],
  pexelsKey?: string, keywords?: string[], usedPexelsIds: Set<number> = new Set()
): Promise<{ id: number; url: string } | null> {
  try {
    log.push('Fetching image from Pexels...')
    const safePrompt = await buildSafeImagePrompt(title, excerpt, category, geminiKey)
    const aiImage = await generateAIImage(safePrompt, geminiKey, pexelsKey, keywords, category, usedPexelsIds)
    if (aiImage?.photoId) usedPexelsIds.add(aiImage.photoId) // mark as used for this run
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
    // Set alt text and caption on the uploaded media
    if (media.id) {
      await fetch(`${wpBase}/wp-json/wp/v2/media/${media.id}`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt_text: title, caption: `${category} news illustration – TrendingVerse` }),
      })
    }
    const imageUrl: string = media.source_url || media.link || ''
    log.push(`AI image generated & uploaded (ID: ${media.id}, URL: ${imageUrl}, ${(compressed.length / 1024).toFixed(0)}KB)`)
    return media.id ? { id: media.id, url: imageUrl } : null
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiKey}`,
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

  // Resolve "Business → Currency Rates" category once (not per task)
  let currencyCategoryId: number | null = null
  try {
    const businessCatId = await getOrCreateCategory(wpBase, auth, 'Business')
    currencyCategoryId = await getOrCreateCategory(wpBase, auth, 'Currency Rates', businessCatId || undefined)
    if (currencyCategoryId) log.push(`[currency] Using category ID ${currencyCategoryId} (Business → Currency Rates)`)
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

  // Step 4 — run AI generation + WordPress push sequentially to avoid Groq free-tier TPM limit (8k/min)
  const taskResults = await mapWithConcurrency(tasks, 1, async (task) => {
    await new Promise(r => setTimeout(r, 5000)) // 5s gap between tasks keeps TPM well under 8k/min
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
  wpBase: string, auth: string, wpUrl: string, adminUserId: string | null, langParam: string, regionParam: string,
  usedTopicKeywords: Set<string> = new Set(),  // within-run topic dedup
  usedPexelsIds: Set<number> = new Set()        // within-run image dedup
): Promise<{ result: any; log: string[] }> {
  const log: string[] = []
  try {
    log.push(`Starting auto-publish | lang: ${langParam} | region: ${regionParam}`)
    log.push('Fetching real news stories...')
    // Fingerprint a topic by its first 3 keywords (catches near-identical topics within a run)
    const topicKey = (kw: string[]) => kw.slice(0, 3).sort().join('|')
    const candidates = await getSourcedTopics(newsApiKey, regionParam)
    log.push(`Real stories found: ${candidates.length}`)

    // Pick the first fresh real story that isn't already on the site or used this run.
    let trend: SourcedTopic | null = null
    for (const c of candidates.slice(0, 8)) {
      if (usedTopicKeywords.has(topicKey(c.keywords))) continue
      if (await checkDuplicate(slugify(c.title), c.title, wpBase, auth)) {
        log.push(`Already covered: ${c.title}`)
        continue
      }
      trend = c
      break
    }

    if (!trend) {
      log.push('No fresh, uncovered real story available — skipping (no invented or evergreen fallback).')
      await supabase.from('cron_logs').insert({ status: 'skipped', title: null, wp_url: wpUrl, log, user_id: adminUserId })
      return { result: { success: false, skipped: true, reason: 'no_real_source' }, log }
    }
    log.push(`Topic: ${trend.title} (source: ${trend.source.publisher})`)
    usedTopicKeywords.add(topicKey(trend.keywords))
    const slug = slugify(trend.title)

    log.push(`Generating article in ${LANGUAGES[langParam] || 'English'} for region: ${regionParam}...`)
    const article = await generateArticle(trend.title, trend.keywords, trend.category, geminiKey, langParam, regionParam, trend.source)
    log.push(`Article: ${article.title}`)

    // Run image fetch and category determination in parallel — independent of each other
    const [wpMediaResult, aiCategory] = await Promise.all([
      generateAndUploadAIImage(article.title, article.excerpt || '', trend.category || 'News', slug, wpBase, auth, geminiKey, log, pexelsKey, trend.keywords, usedPexelsIds),
      determineCategory(article.title, article.excerpt || '', geminiKey),
    ])
    const wpMediaId = wpMediaResult?.id ?? null
    const coverImageUrl = wpMediaResult?.url || null

    const catId = await getOrCreateCategory(wpBase, auth, aiCategory)
    const categoryIds = catId ? [catId] : []
    log.push(`Category: ${aiCategory}${catId ? '' : ' (could not create — publishing uncategorized)'}`)

    // Replace <!-- tv-ad-slot --> comment with actual AdSense in-article unit
    const ADSENSE_PUB = 'ca-pub-1703630141275716'
    const adHtml = `<div class="tv-mid-article-ad" style="text-align:center;margin:24px 0;">
<ins class="adsbygoogle" style="display:block;text-align:center;" data-ad-layout="in-article" data-ad-format="fluid" data-ad-client="${ADSENSE_PUB}" data-ad-slot="auto"></ins>
<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`
    const contentWithAd = (article.content || '').replace('<!-- tv-ad-slot -->', adHtml)

    // The theme already renders the featured image above the content.
    // Strip the leading <figure> placeholder from the content body entirely
    // to avoid a duplicate image at the top of every article.
    // Always end with a visible attribution to the real source story.
    const escHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    const sourceLine = `<p class="tv-source"><strong>Source:</strong> <a href="${escHtml(trend.source.url)}" rel="nofollow noopener" target="_blank">${escHtml(trend.source.publisher)}</a> &mdash; ${escHtml(trend.source.title)}</p>`
    const finalContent = contentWithAd
      .replace(/^\s*<figure[^>]*>\s*<img[^>]*>\s*<\/figure>\s*/i, '')
      .replace(/^\s*<h1[^>]*>.*?<\/h1>\s*/is, '') // strip leading H1 — WP already renders the post title
      .replace(/<p class="tv-author-byline">[\s\S]*?<\/p>/gi, '') // site template renders the byline
      .trimStart() + '\n' + sourceLine

    log.push('Publishing to WordPress...')
    const wpRes = await fetch(`${wpBase}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        title: article.title,
        content: finalContent,
        excerpt: article.excerpt,
        status: 'publish',
        slug: slugify(article.title),
        categories: categoryIds,
        ...(wpMediaId ? { featured_media: wpMediaId } : {}),
        meta: {
          // Yoast SEO meta
          _yoast_wpseo_title: article.seo_title || article.title,
          _yoast_wpseo_metadesc: article.meta_description || '',
          _yoast_wpseo_focuskw: article.focus_keyword || '',
          // Rank Math meta (set alongside Yoast so whichever plugin is active picks it up)
          rank_math_title: article.seo_title || article.title,
          rank_math_description: article.meta_description || '',
          rank_math_focus_keyword: article.focus_keyword || '',
        }
      }),
    })
    const wpData = await wpRes.json()
    if (!wpRes.ok) throw new Error(wpData.message || 'WordPress publish failed')
    log.push(`Published: ${wpData.link}`)

    // ── Notify search engines immediately after each publish ──────
    const publishedUrl: string = wpData.link || ''
    if (publishedUrl) {
      const indexNowKey = process.env.INDEXNOW_KEY || 'rankmath'
      const siteHost = 'trendingverse.online'
      await Promise.allSettled([
        // IndexNow (Bing + Yandex) — single URL, server-side so no CORS
        fetch('https://api.indexnow.org/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ host: siteHost, key: indexNowKey, urlList: [publishedUrl] }),
        }).then(r => { log.push(`IndexNow: ${r.status}`) }).catch(() => {}),
        // Google sitemap ping — fastest way to surface new content
        fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(`https://${siteHost}/sitemap_index.xml`)}`)
          .then(r => { log.push(`Google sitemap ping: ${r.status}`) }).catch(() => {}),
      ])
    }
    // ─────────────────────────────────────────────────────────────

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
      cover_image_url: coverImageUrl || null,
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

  const geminiKey = process.env.GEMINI_API_KEY
  const pexelsKey = process.env.PEXELS_API_KEY || 'Hg3cYZqEt9VuKvMh0eP8UBbrzYXUSpLrUMitD9ecBVDLyuwaXyRR3K0Z'
  const newsApiKey = process.env.NEWS_API_KEY
  const wpUrl = process.env.WP_URL
  const wpUsername = process.env.WP_USERNAME
  const wpPassword = process.env.WP_APP_PASSWORD

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY||'')!
  )

  const authListRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, { headers: { 'apikey': (process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY||'')!, 'Authorization': `Bearer ${(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY||'')!}` } })
  const authListData = authListRes.ok ? await authListRes.json() : {}
  const adminUserId = (authListData.users || []).find((u: any) => u.email === ADMIN_EMAIL)?.id || null

  const url = new URL(req.url)
  const langParam = url.searchParams.get('lang') || 'en'
  const regionParam = url.searchParams.get('region') || '' // empty = auto-cycle all regions
  // mode=article (default) — trending news only
  // mode=currency — currency rates + direct-ads pacing only
  // mode=all — everything (original behaviour)
  const mode = url.searchParams.get('mode') || 'article'

  if (!geminiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 })
  if (!wpUrl || !wpUsername || !wpPassword) return NextResponse.json({ error: 'WordPress credentials not set' }, { status: 500 })

  const wpBase = wpUrl.replace(/\/$/, '')
  const auth = Buffer.from(`${wpUsername}:${wpPassword}`).toString('base64')

  const runArticle  = mode === 'article' || mode === 'all'
  const runCurrency = mode === 'currency' || mode === 'all'

  // ── Multi-region article publishing ──────────────────────────────
  // When no specific region is given, cycle through all three regions sequentially.
  // USA gets 3 articles (highest CPM), India gets 2, GCC gets 2.
  // A specific ?region=X still publishes just one article for that region.
  const articleResults: any[] = []
  const articleLog: string[] = []

  if (runArticle) {
    const regionSchedule = regionParam
      ? [regionParam]  // explicit region from query param → one article
      : ['India', 'GCC', 'USA'] // 1 per region per run — stays within Cloudflare subrequest limit

    // Shared state across all articles in this run — prevents same topic/image in a single cron batch
    const usedTopicKeywords = new Set<string>()
    const usedPexelsIds = new Set<number>()

    for (const region of regionSchedule) {
      const outcome = await runArticlePublish(
        supabase, geminiKey, pexelsKey, newsApiKey, wpBase, auth, wpUrl, adminUserId, langParam, region,
        usedTopicKeywords, usedPexelsIds
      )
      articleResults.push({ region, ...outcome.result })
      articleLog.push(...outcome.log)
      // Small gap between articles to avoid Gemini rate limits
      if (regionSchedule.indexOf(region) < regionSchedule.length - 1) {
        await new Promise(r => setTimeout(r, 3000))
      }
    }
  }

  const [currencyOutcome, pacingOutcome] = await Promise.all([
    runCurrency
      ? runCurrencyRatesUpdate(supabase, geminiKey, wpBase, auth).catch((e) => ({ updated: 0, failed: 0, log: [`Currency rates error: ${(e as Error).message}`] }))
      : Promise.resolve({ updated: 0, failed: 0, log: [] }),
    runCurrency
      ? runDirectAdsPacing(supabase).catch((e) => ({ processed: 0, paused: 0, log: [`Direct-ads pacing error: ${(e as Error).message}`] }))
      : Promise.resolve({ processed: 0, paused: 0, log: [] }),
  ])
  if (runCurrency) {
    fetch(`${new URL(req.url).origin}/api/mediation/revenue/sync?secret=${process.env.CRON_SECRET}`).catch(() => {})
  }

  const log = [...articleLog, ...currencyOutcome.log, ...pacingOutcome.log]

  return NextResponse.json({
    articles: articleResults,
    article_count: articleResults.filter(r => r.success).length,
    currency: { updated: currencyOutcome.updated, failed: currencyOutcome.failed },
    direct_ads: { processed: pacingOutcome.processed, completed: pacingOutcome.paused },
    log,
  })
}
