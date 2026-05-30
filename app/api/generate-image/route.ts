import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { title, content, wp_url, wp_username, wp_password } = await req.json()

  const pexelsKey = process.env.PEXELS_API_KEY
  if (!pexelsKey) return NextResponse.json({ error: 'PEXELS_API_KEY not set' }, { status: 500 })

  // Extract keywords from title — ASCII only, remove non-Latin characters
  const cleanTitle = (title || '').replace(/[^\x00-\x7F]/g, ' ').trim()
  const keywords = cleanTitle
    .split(' ')
    .filter((w: string) => w.length > 3)
    .slice(0, 3)
    .join(' ') || 'news article india'

  try {
    // Search Pexels
    const pexelsRes = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(keywords)}&per_page=3&orientation=landscape&size=large`,
      { headers: { Authorization: pexelsKey } }
    )

    if (!pexelsRes.ok) {
      return NextResponse.json({ error: 'Pexels search failed', success: false })
    }

    const pexelsData = await pexelsRes.json()
    const photo = pexelsData.photos?.[0]

    if (!photo) {
      return NextResponse.json({ error: 'No photos found', success: false })
    }

    // Download image
    const imageUrl = photo.src.large || photo.src.original
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) return NextResponse.json({ error: 'Failed to download image', success: false })

    const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

    // Upload to WordPress — use ONLY ASCII filename, never use title or Kannada text
    if (wp_url && wp_username && wp_password) {
      const base = wp_url.replace(/\/$/, '')
      const auth = Buffer.from(`${wp_username}:${wp_password}`).toString('base64')

      // Safe ASCII-only filename using timestamp
      const safeFilename = `trendingverse-${Date.now()}.jpg`

      const uploadRes = await fetch(`${base}/wp-json/wp/v2/media`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'image/jpeg',
          'Content-Disposition': `attachment; filename="${safeFilename}"`,
        },
        body: imgBuffer,
      })

      if (uploadRes.ok) {
        const media = await uploadRes.json()
        return NextResponse.json({
          success: true,
          wp_media_id: media.id,
          image_url: imageUrl,
          search_query: keywords,
          photographer: photo.photographer,
        })
      }

      const uploadErr = await uploadRes.json().catch(() => ({}))
      return NextResponse.json({
        success: false,
        error: uploadErr.message || `Upload failed: ${uploadRes.status}`,
        image_url: imageUrl,
        search_query: keywords,
        photographer: photo.photographer,
      })
    }

    return NextResponse.json({
      success: true,
      image_url: imageUrl,
      search_query: keywords,
      photographer: photo.photographer,
    })

  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, success: false })
  }
}
