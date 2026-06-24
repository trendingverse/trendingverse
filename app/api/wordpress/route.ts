import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const VALID_CATEGORIES = [
  'Politics', 'Business', 'Technology', 'Entertainment', 'Sports',
  'Health', 'Science', 'Lifestyle', 'Education', 'World',
  'Crime', 'India', 'Environment', 'Finance', 'Trending'
]

interface AdUnit {
  id: string; ad_type: 'gam' | 'direct'; position: string; ad_code: string
  gam_network_code?: string; gam_unit_path?: string; size_width: number; size_height: number
}
interface PublisherAd {
  ad_units: AdUnit; inject_after_paragraph: number; is_enabled: boolean; position?: string
}

function buildAdHtml(unit: AdUnit): string {
  if (unit.ad_type === 'gam' && unit.gam_network_code && unit.gam_unit_path) {
    const divId = `gpt-ad-${unit.id.slice(0, 8)}-${Date.now()}`
    return `\n<div id="${divId}" style="text-align:center;margin:20px auto;clear:both;">
<script>
googletag = window.googletag || {cmd: []};
googletag.cmd.push(function() {
  googletag.defineSlot('${unit.gam_unit_path}', [[${unit.size_width}, ${unit.size_height}]], '${divId}').addService(googletag.pubads());
  googletag.pubads().enableSingleRequest();
  googletag.enableServices();
  googletag.display('${divId}');
});
</script>
</div>\n`
  }
  return `\n<div style="text-align:center;margin:20px auto;clear:both;">${unit.ad_code}</div>\n`
}

function injectAdsIntoContent(content: string, publisherAds: PublisherAd[]): string {
  if (!publisherAds.length) return content
  const inContentAds = publisherAds
    .filter(a => a.is_enabled && a.ad_units?.position === 'in_content')
    .sort((a, b) => (a.inject_after_paragraph || 2) - (b.inject_after_paragraph || 2))
  if (!inContentAds.length) return content
  const parts = content.split('</p>')
  const result: string[] = []
  for (let i = 0; i < parts.length; i++) {
    result.push(parts[i])
    if (i < parts.length - 1) {
      result.push('</p>')
      for (const pa of inContentAds) {
        if (i + 1 === (pa.inject_after_paragraph || 2)) result.push(buildAdHtml(pa.ad_units))
      }
    }
  }
  return result.join('')
}

function wrapWithAds(content: string, publisherAds: PublisherAd[]): string {
  const headerAds = publisherAds.filter(a => a.is_enabled && a.ad_units?.position === 'header').map(a => buildAdHtml(a.ad_units)).join('')
  const footerAds = publisherAds.filter(a => a.is_enabled && a.ad_units?.position === 'footer').map(a => buildAdHtml(a.ad_units)).join('')
  return `${headerAds}${injectAdsIntoContent(content, publisherAds)}${footerAds}`
}

async function wpFetch(url: string, auth: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', ...options.headers },
  })
  const text = await res.text()
  if (text.trim().startsWith('<') || text.trim().startsWith('<!')) {
    throw new Error(`WordPress returned HTML instead of JSON (HTTP ${res.status}). Check your WordPress URL and credentials.`)
  }
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) }
  } catch {
    throw new Error(`Invalid JSON from WordPress (HTTP ${res.status}): ${text.slice(0, 100)}`)
  }
}

// Get or create a tag in WordPress, return its ID
async function getOrCreateTag(base: string, auth: string, tagName: string): Promise<number | null> {
  try {
    const slug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const searchRes = await wpFetch(`${base}/wp-json/wp/v2/tags?search=${encodeURIComponent(tagName)}&per_page=5`, auth)
    if (searchRes.ok && Array.isArray(searchRes.data)) {
      const existing = searchRes.data.find((t: { name: string; slug: string }) =>
        t.name.toLowerCase() === tagName.toLowerCase() || t.slug === slug
      )
      if (existing) return existing.id
    }
    const createRes = await wpFetch(`${base}/wp-json/wp/v2/tags`, auth, {
      method: 'POST',
      body: JSON.stringify({ name: tagName, slug }),
    })
    if (createRes.ok && createRes.data?.id) return createRes.data.id
  } catch { /* skip failed tag */ }
  return null
}

// Get or create a CATEGORY in WordPress, return its ID — never silently
// drops to "Uncategorized" when a category name doesn't exist yet.
async function getOrCreateCategory(base: string, auth: string, name: string): Promise<number | null> {
  try {
    const searchRes = await wpFetch(`${base}/wp-json/wp/v2/categories?search=${encodeURIComponent(name)}&per_page=10`, auth)
    if (searchRes.ok && Array.isArray(searchRes.data)) {
      const existing = searchRes.data.find((c: { name: string }) => c.name.toLowerCase() === name.toLowerCase())
      if (existing) return existing.id
    }
    const createRes = await wpFetch(`${base}/wp-json/wp/v2/categories`, auth, {
      method: 'POST',
      body: JSON.stringify({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-') }),
    })
    if (createRes.ok && createRes.data?.id) return createRes.data.id
  } catch { /* skip */ }
  return null
}

// Determines the correct category from the article's actual content —
// never just trusts whatever category_name happens to already be set
// (which is how dozens of articles ended up Uncategorized previously).
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

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { article_id, wp_url, wp_username, wp_password, featured_media } = await req.json()
  if (!article_id || !wp_url || !wp_username || !wp_password) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: article, error } = await supabase
    .from('articles').select('*, categories(name)').eq('id', article_id).single()
  if (error || !article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

  const base = wp_url.replace(/\/$/, '')
  const auth = Buffer.from(`${wp_username}:${wp_password}`).toString('base64')
  const geminiKey = process.env.GEMINI_API_KEY!

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: site } = await admin.from('sites').select('id').eq('user_id', user.id).eq('site_url', base).single()

  let articleContent = article.content || ''
  if (site?.id) {
    const { data: publisherAds } = await admin.from('publisher_ads').select('*, ad_units(*)').eq('publisher_id', user.id).eq('site_id', site.id).eq('is_enabled', true)
    if (publisherAds?.length) articleContent = wrapWithAds(articleContent, publisherAds as PublisherAd[])
  }

  try {
    // Test credentials first
    const authTest = await wpFetch(`${base}/wp-json/wp/v2/users/me`, auth)
    if (!authTest.ok) {
      return NextResponse.json({
        error: `WordPress authentication failed (${authTest.status}). Check your username and application password.`
      }, { status: 401 })
    }

    // Duplicate check
    const slugCheck = await wpFetch(`${base}/wp-json/wp/v2/posts?slug=${encodeURIComponent(article.slug)}&status=any`, auth)
    if (slugCheck.ok && Array.isArray(slugCheck.data) && slugCheck.data.length > 0) {
      return NextResponse.json({ error: `Duplicate: slug already exists`, duplicate: true, existing_url: slugCheck.data[0].link }, { status: 409 })
    }

    const titleCheck = await wpFetch(`${base}/wp-json/wp/v2/posts?search=${encodeURIComponent(article.title.slice(0, 30))}&status=any&per_page=5`, auth)
    if (titleCheck.ok && Array.isArray(titleCheck.data)) {
      const exact = titleCheck.data.find((p: { title: { rendered: string } }) =>
        p.title.rendered.toLowerCase().trim() === article.title.toLowerCase().trim()
      )
      if (exact) return NextResponse.json({ error: 'Duplicate: same title exists', duplicate: true, existing_url: exact.link }, { status: 409 })
    }

    // Determine the correct category from the actual content, then
    // auto-create it on WordPress if it doesn't already exist there.
    const aiCategory = await determineCategory(article.title, article.excerpt || '', geminiKey)
    const catId = await getOrCreateCategory(base, auth, aiCategory)
    const categoryIds = catId ? [catId] : []

    // Process tags — from article.keywords array
    const tagIds: number[] = []
    const rawTags: string[] = []

    if (Array.isArray(article.keywords) && article.keywords.length > 0) {
      rawTags.push(...article.keywords.slice(0, 10))
    }
    if (article.focus_keyword && !rawTags.includes(article.focus_keyword)) {
      rawTags.unshift(article.focus_keyword)
    }
    if (aiCategory && !rawTags.includes(aiCategory)) {
      rawTags.push(aiCategory)
    }

    if (rawTags.length > 0) {
      const tagPromises = rawTags.slice(0, 10).map(tag => getOrCreateTag(base, auth, tag))
      const resolvedIds = await Promise.all(tagPromises)
      tagIds.push(...resolvedIds.filter((id): id is number => id !== null))
    }

    // Publish
    const wpRes = await wpFetch(`${base}/wp-json/wp/v2/posts`, auth, {
      method: 'POST',
      body: JSON.stringify({
        title: article.title,
        content: articleContent,
        excerpt: article.excerpt || '',
        status: 'publish',
        slug: article.slug,
        categories: categoryIds,
        tags: tagIds,
        ...(featured_media ? { featured_media } : {}),
        meta: {
          _yoast_wpseo_title: article.seo_title || article.title,
          _yoast_wpseo_metadesc: article.meta_description || '',
          _yoast_wpseo_focuskw: article.focus_keyword || '',
        }
      }),
    })

    if (!wpRes.ok) return NextResponse.json({ error: wpRes.data.message || 'WordPress publish failed', code: wpRes.data.code }, { status: wpRes.status })

    // Save wp_post_id AND the actual category used — keeps Supabase and
    // WordPress reliably in sync going forward.
    await supabase.from('articles').update({
      status: 'published',
      published_at: new Date().toISOString(),
      wp_post_id: wpRes.data.id,
      category_name: aiCategory,
    }).eq('id', article_id)

    return NextResponse.json({
      success: true,
      wp_post_id: wpRes.data.id,
      wp_url: wpRes.data.link,
      category: aiCategory,
      category_auto_created: !!catId,
      ads_injected: !!site?.id,
      tags_added: tagIds.length,
    })

  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
