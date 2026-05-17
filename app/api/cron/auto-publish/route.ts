import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Verify cron secret
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  const headerSecret = req.headers.get('authorization')?.replace('Bearer ', '')
  const querySecret = new URL(req.url).searchParams.get('secret')
  return headerSecret === cronSecret || querySecret === cronSecret || req.headers.get('x-vercel-cron') === '1'
}

async function getTrendingTopic(geminiKey: string, newsApiKey?: string): Promise<{ title: string; category: string; keywords: string[] }> {
  // Try NewsAPI first for real trending topics
  if (newsApiKey) {
    try {
      const res = await fetch(
        `https://newsapi.org/v2/top-headlines?country=in&pageSize=10&apiKey=${newsApiKey}`,
        { cache: 'no-store' }
      )
      if (res.ok) {
        const data = await res.json()
        const articles = (data.articles || []).filter((a: { title: string }) =>
          a.title && a.title !== '[Removed]' && a.title.length > 20
        )
        if (articles.length > 0) {
          // Pick random article from top 5
          const pick = articles[Math.floor(Math.random() * Math.min(5, articles.length))]
          const title = pick.title.replace(/ [-|] [^-|]+$/, '').trim()
          return { title, category: 'News', keywords: title.split(' ').filter((w: string) => w.length > 4).slice(0, 5) }
        }
      }
    } catch { /* fallback to Gemini */ }
  }

  // Gemini trending topic detection
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `Today is ${today}. Give me ONE highly trending news topic in India right now that would make a great SEO article. Choose from: technology, politics, business, sports, entertainment, health. Return ONLY JSON: {"title":"Specific engaging headline","category":"Technology","keywords":["kw1","kw2","kw3","kw4","kw5"]}` }]
        }],
        generationConfig: { temperature: 1 }
      }),
      cache: 'no-store'
    }
  )
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const match = text.match(/\{[\s\S]*\}/)
  if (match) {
    try { return JSON.parse(match[0]) } catch { /* fallback */ }
  }
  return { title: `Top Technology Trends in India ${new Date().getFullYear()}`, category: 'Technology', keywords: ['technology', 'india', 'trends'] }
}

async function generateArticle(title: string, keywords: string[], category: string, geminiKey: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `You are a senior journalist for TrendingVerse, a professional Indian news portal.

Write a complete, original, SEO-optimized, Google Discover-ready news article.

Title: ${title}
Category: ${category}
Keywords: ${keywords.join(', ')}
Target audience: Indian readers
Tone: Professional, journalistic, engaging, factual
Word count: 700-900 words

SEO Requirements:
- Include focus keyword in first paragraph
- Use H2/H3 subheadings
- Write compelling meta description (150-160 chars)
- E-E-A-T compliant (show expertise, experience, authority, trust)
- No AI spam patterns, no repetitive filler
- Google AdSense safe content
- Original analysis and insights

Return ONLY valid JSON:
{
  "title": "Compelling SEO headline (50-65 chars)",
  "content": "Full article HTML using only <p><h2><h3><strong><em><ul><li> tags",
  "excerpt": "2-3 sentence summary for Google Discover",
  "seo_title": "SEO title 50-60 chars with keyword",
  "meta_description": "Meta description 150-160 chars with keyword and CTA",
  "focus_keyword": "primary keyword phrase",
  "keywords": ["kw1","kw2","kw3","kw4","kw5"],
  "tags": ["tag1","tag2","tag3","tag4","tag5"],
  "reading_time": 4
}` }]
        }],
        generationConfig: { temperature: 1, maxOutputTokens: 4096 }
      }),
      cache: 'no-store'
    }
  )
  const data = await res.json()
// Handle thinking model - get all text parts
const parts = data.candidates?.[0]?.content?.parts || []
const text = parts
  .filter((p: { text?: string }) => p.text)
  .map((p: { text: string }) => p.text)
  .join('')
  .replace(/```json\n?|```/g, '')
  .trim()

if (!text) throw new Error('Gemini returned empty response: ' + JSON.stringify(data).slice(0, 200))

// Find JSON object - get the LAST match to skip thinking content
const matches = [...text.matchAll(/\{[\s\S]*?"reading_time"[\s\S]*?\}/g)]
const jsonStr = matches.length > 0
  ? matches[matches.length - 1][0]
  : text.match(/\{[\s\S]*\}/)?.[0]

if (!jsonStr) throw new Error('No JSON found in response. Raw: ' + text.slice(0, 300))
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

async function uploadImageToWordPress(imageUrl: string, title: string, wpBase: string, auth: string) {
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) return null
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer())
  const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}-${Date.now()}.jpg`
  const uploadRes = await fetch(`${wpBase}/wp-json/wp/v2/media`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'image/jpeg',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
    body: imgBuffer,
  })
  if (!uploadRes.ok) return null
  const media = await uploadRes.json()
  return media.id || null
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

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const geminiKey = process.env.GEMINI_API_KEY
  const pexelsKey = process.env.PEXELS_API_KEY
  const newsApiKey = process.env.NEWS_API_KEY
  const wpUrl = process.env.WP_URL
  const wpUsername = process.env.WP_USERNAME
  const wpPassword = process.env.WP_APP_PASSWORD

  if (!geminiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 })
  if (!wpUrl || !wpUsername || !wpPassword) return NextResponse.json({ error: 'WordPress credentials not set in env vars' }, { status: 500 })

  const wpBase = wpUrl.replace(/\/$/, '')
  const auth = Buffer.from(`${wpUsername}:${wpPassword}`).toString('base64')
  const supabase = await createClient()

  const log: string[] = []

  try {
    // Step 1: Get trending topic
    log.push('Fetching trending topic...')
    const trend = await getTrendingTopic(geminiKey, newsApiKey)
    log.push(`Topic: ${trend.title}`)

    // Step 2: Check for duplicate
    const slug = slugify(trend.title)
    const isDuplicate = await checkDuplicate(slug, trend.title, wpBase, auth)
    if (isDuplicate) {
      log.push(`Duplicate detected for: ${trend.title} — skipping`)
      return NextResponse.json({ success: false, skipped: true, reason: 'duplicate', log })
    }

    // Step 3: Generate article
    log.push('Generating article with Gemini AI...')
    const article = await generateArticle(trend.title, trend.keywords, trend.category, geminiKey)
    log.push(`Article generated: ${article.title}`)

    // Step 4: Fetch image from Pexels
    let wpMediaId: number | null = null
    if (pexelsKey) {
      log.push('Fetching editorial image from Pexels...')
      const photo = await fetchPexelsImage(trend.keywords.slice(0, 2).join(' '), pexelsKey)
      if (photo) {
        wpMediaId = await uploadImageToWordPress(photo.src.large || photo.src.original, article.title, wpBase, auth)
        log.push(wpMediaId ? `Image uploaded (ID: ${wpMediaId})` : 'Image upload failed — continuing without')
      }
    }

    // Step 5: Get WordPress category ID
    const catRes = await fetch(`${wpBase}/wp-json/wp/v2/categories?per_page=100`, { headers: { Authorization: `Basic ${auth}` } })
    const wpCats = catRes.ok ? await catRes.json() : []
    const matched = wpCats.find((c: { name: string }) => c.name.toLowerCase() === (trend.category || 'news').toLowerCase())
    const categoryIds = matched ? [matched.id] : []

    // Step 6: Publish to WordPress
    log.push('Publishing to WordPress...')
    const wpPayload: Record<string, unknown> = {
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
    }

    const wpRes = await fetch(`${wpBase}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify(wpPayload),
    })
    const wpData = await wpRes.json()
    if (!wpRes.ok) throw new Error(wpData.message || 'WordPress publish failed')

    log.push(`Published: ${wpData.link}`)

    // Step 7: Save to Supabase
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
      author_name: 'TrendingVerse AI',
      word_count: (article.content || '').split(' ').length,
      reading_time_min: article.reading_time || 4,
      published_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      title: article.title,
      wp_url: wpData.link,
      wp_post_id: wpData.id,
      log,
    })

  } catch (e) {
    log.push(`Error: ${(e as Error).message}`)
    return NextResponse.json({ success: false, error: (e as Error).message, log }, { status: 500 })
  }
}
