import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

interface AdUnit {
  id: string
  ad_type: 'gam' | 'direct'
  position: string
  ad_code: string
  gam_network_code?: string
  gam_unit_path?: string
  size_width: number
  size_height: number
}

interface PublisherAd {
  ad_units: AdUnit
  inject_after_paragraph: number
  is_enabled: boolean
  position?: string
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

  // Split by closing paragraph tags
  const parts = content.split('</p>')
  const result: string[] = []

  for (let i = 0; i < parts.length; i++) {
    result.push(parts[i])
    if (i < parts.length - 1) {
      result.push('</p>')
      // Inject ads after specified paragraphs
      for (const pa of inContentAds) {
        if (i + 1 === (pa.inject_after_paragraph || 2)) {
          result.push(buildAdHtml(pa.ad_units))
        }
      }
    }
  }

  return result.join('')
}

function wrapWithAds(content: string, publisherAds: PublisherAd[]): string {
  const headerAds = publisherAds
    .filter(a => a.is_enabled && a.ad_units?.position === 'header')
    .map(a => buildAdHtml(a.ad_units)).join('')

  const footerAds = publisherAds
    .filter(a => a.is_enabled && a.ad_units?.position === 'footer')
    .map(a => buildAdHtml(a.ad_units)).join('')

  // Inject in-content ads
  const contentWithAds = injectAdsIntoContent(content, publisherAds)

  return `${headerAds}${contentWithAds}${footerAds}`
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
    .from('articles')
    .select('*, categories(name)')
    .eq('id', article_id)
    .single()

  if (error || !article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

  const base = wp_url.replace(/\/$/, '')
  const auth = Buffer.from(`${wp_username}:${wp_password}`).toString('base64')

  // Get publisher's active ad units for this site
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: site } = await admin
    .from('sites')
    .select('id')
    .eq('user_id', user.id)
    .eq('site_url', wp_url.replace(/\/$/, ''))
    .single()

  let articleContent = article.content || ''

  if (site?.id) {
    const { data: publisherAds } = await admin
      .from('publisher_ads')
      .select('*, ad_units(*)')
      .eq('publisher_id', user.id)
      .eq('site_id', site.id)
      .eq('is_enabled', true)

    if (publisherAds?.length) {
      articleContent = wrapWithAds(articleContent, publisherAds as PublisherAd[])
    }
  }

  try {
    console.log('WP base URL:', base)
console.log('Auth header:', auth.slice(0, 10) + '...')
    // Duplicate check
    const [slugCheck, titleCheck] = await Promise.all([
      fetch(`${base}/wp-json/wp/v2/posts?slug=${encodeURIComponent(article.slug)}&status=any`, { headers: { Authorization: `Basic ${auth}` } }),
      fetch(`${base}/wp-json/wp/v2/posts?search=${encodeURIComponent(article.title.slice(0, 30))}&status=any&per_page=5`, { headers: { Authorization: `Basic ${auth}` } }),
    ])

    const slugData = slugCheck.ok ? await slugCheck.json() : []
    if (Array.isArray(slugData) && slugData.length > 0) {
      return NextResponse.json({ error: `Duplicate: slug "${article.slug}" already exists`, duplicate: true, existing_url: slugData[0].link }, { status: 409 })
    }

    const titleData = titleCheck.ok ? await titleCheck.json() : []
    if (Array.isArray(titleData)) {
      const exact = titleData.find((p: { title: { rendered: string } }) =>
        p.title.rendered.toLowerCase().trim() === article.title.toLowerCase().trim()
      )
      if (exact) return NextResponse.json({ error: 'Duplicate: same title exists', duplicate: true, existing_url: exact.link }, { status: 409 })
    }

    // Get WP categories
    const catRes = await fetch(`${base}/wp-json/wp/v2/categories?per_page=100`, { headers: { Authorization: `Basic ${auth}` } })
    const wpCats = catRes.ok ? await catRes.json() : []
    const catName = article.categories?.name || article.category_name || ''
    const matched = wpCats.find((c: { name: string; id: number }) => c.name.toLowerCase() === catName.toLowerCase())
    const categoryIds = matched ? [matched.id] : []

    // Push to WordPress with ads injected
    const wpRes = await fetch(`${base}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        title: article.title,
        content: articleContent, // content with ads injected
        excerpt: article.excerpt || '',
        status: 'publish',
        slug: article.slug,
        categories: categoryIds,
        ...(featured_media ? { featured_media } : {}),
        meta: {
          _yoast_wpseo_title: article.seo_title || article.title,
          _yoast_wpseo_metadesc: article.meta_description || '',
          _yoast_wpseo_focuskw: article.focus_keyword || '',
        }
      }),
    })

    const wpData = await wpRes.json()
    if (!wpRes.ok) return NextResponse.json({ error: wpData.message || 'WordPress API error', code: wpData.code }, { status: wpRes.status })

    // Mark as published
    await supabase.from('articles').update({
      status: 'published',
      published_at: new Date().toISOString(),
    }).eq('id', article_id)

    return NextResponse.json({
      success: true,
      wp_post_id: wpData.id,
      wp_url: wpData.link,
      ads_injected: site?.id ? true : false,
    })

  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
