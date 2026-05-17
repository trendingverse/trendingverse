import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, content, article_id, wp_url, wp_username, wp_password } = await req.json()
  const pexelsKey = process.env.PEXELS_API_KEY

  if (!pexelsKey) {
    return NextResponse.json({ error: 'PEXELS_API_KEY not set in Vercel environment variables' }, { status: 500 })
  }

  // Extract best search keywords from title
  const stopWords = new Set(['a','an','the','and','or','but','in','on','at','to','for','of','with','by','from','is','are','was','were','has','have','had','will','would','could','should','this','that','these','those','after','before','about','how','why','what','when','where','who'])
  const keywords = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(' ')
    .filter((w: string) => w.length > 3 && !stopWords.has(w))
    .slice(0, 3)
    .join(' ')

  const searchQuery = keywords || title.split(' ').slice(0, 3).join(' ')

  try {
    // Search Pexels for relevant editorial photos
    const searchRes = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=5&orientation=landscape&size=large`,
      { headers: { Authorization: pexelsKey } }
    )

    if (!searchRes.ok) {
      return NextResponse.json({ error: 'Pexels API error: ' + searchRes.statusText }, { status: searchRes.status })
    }

    const searchData = await searchRes.json()
    const photos = searchData.photos || []

    if (photos.length === 0) {
      // Try broader search with first word
      const fallbackQuery = title.split(' ')[0]
      const fallbackRes = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(fallbackQuery)}&per_page=5&orientation=landscape`,
        { headers: { Authorization: pexelsKey } }
      )
      const fallbackData = await fallbackRes.json()
      if (!fallbackData.photos?.length) {
        return NextResponse.json({ error: 'No images found for this topic on Pexels' }, { status: 404 })
      }
      photos.push(...fallbackData.photos)
    }

    // Pick the best photo (first result, landscape, large)
    const photo = photos[0]
    const imageUrl = photo.src.large2x || photo.src.large || photo.src.original
    const photographer = photo.photographer
    const pexelsUrl = photo.url

    // Download the image
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) {
      return NextResponse.json({ error: 'Failed to download image from Pexels' }, { status: 500 })
    }
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer())
    const mimeType = imgRes.headers.get('content-type') || 'image/jpeg'
    const ext = mimeType.includes('png') ? 'png' : 'jpg'

    let wpMediaId: number | null = null
    let wpMediaUrl: string | null = null

    // Upload to WordPress media library
    if (wp_url && wp_username && wp_password) {
      const base = wp_url.replace(/\/$/, '')
      const auth = Buffer.from(`${wp_username}:${wp_password}`).toString('base64')
      const filename = `${searchQuery.replace(/\s+/g, '-')}-${Date.now()}.${ext}`

      const uploadRes = await fetch(`${base}/wp-json/wp/v2/media`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
        body: imgBuffer,
      })

      if (uploadRes.ok) {
        const mediaData = await uploadRes.json()
        wpMediaId = mediaData.id
        wpMediaUrl = mediaData.source_url

        // Set alt text and caption with photographer credit
        if (wpMediaId) {
          await fetch(`${base}/wp-json/wp/v2/media/${wpMediaId}`, {
            method: 'POST',
            headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              alt_text: title,
              caption: `Photo by ${photographer} on Pexels`,
              description: `Source: ${pexelsUrl}`,
            }),
          })
        }
      }
    }

    // Save to Supabase article
    if (article_id && wpMediaUrl) {
      await supabase.from('articles').update({
        cover_image_url: wpMediaUrl,
        cover_image_alt: title,
      }).eq('id', article_id)
    }

    return NextResponse.json({
      success: true,
      image_url: imageUrl,
      wp_media_id: wpMediaId,
      wp_media_url: wpMediaUrl,
      photographer,
      pexels_url: pexelsUrl,
      search_query: searchQuery,
    })

  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
