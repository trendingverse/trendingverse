import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, content, article_id, wp_url, wp_username, wp_password } = await req.json()
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 })

  // Build editorial image prompt from article title/content
  const excerpt = (content || '').replace(/<[^>]+>/g, '').slice(0, 200)
  const prompt = `Professional news editorial photograph for article: "${title}". ${excerpt}. 
Style: high-quality photojournalism, editorial news style, realistic, professional lighting, 
no text overlays, no watermarks, suitable for news website featured image, 
16:9 aspect ratio, sharp focus, dramatic but professional composition.`

  try {
    // Use Imagen 4 for image generation
    const imgRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '16:9',
            safetyFilterLevel: 'block_some',
            personGeneration: 'allow_adult',
          }
        })
      }
    )

    if (!imgRes.ok) {
      const err = await imgRes.json()
      // Fallback: try Gemini 2.5 Flash image model
      return await fallbackImageGen(apiKey, prompt, title, article_id, wp_url, wp_username, wp_password, supabase)
    }

    const imgData = await imgRes.json()
    const b64 = imgData.predictions?.[0]?.bytesBase64Encoded

    if (!b64) {
      return await fallbackImageGen(apiKey, prompt, title, article_id, wp_url, wp_username, wp_password, supabase)
    }

    // Upload to WordPress if credentials provided
    if (wp_url && wp_username && wp_password) {
      const wpMediaId = await uploadToWordPress(b64, title, wp_url, wp_username, wp_password)
      if (article_id && wpMediaId) {
        // Store image info in article
        await supabase.from('articles').update({
          cover_image_alt: `Featured image for: ${title}`
        }).eq('id', article_id)
      }
      return NextResponse.json({
        success: true,
        image_b64: b64,
        wp_media_id: wpMediaId,
        source: 'imagen4'
      })
    }

    return NextResponse.json({ success: true, image_b64: b64, source: 'imagen4' })

  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

async function fallbackImageGen(
  apiKey: string, prompt: string, title: string,
  article_id: string, wp_url: string, wp_username: string, wp_password: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
) {
  // Try gemini-2.5-flash-image as fallback
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
        })
      }
    )
    const data = await res.json()
    const parts = data.candidates?.[0]?.content?.parts || []
    const imgPart = parts.find((p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData)
    if (!imgPart?.inlineData?.data) {
      return NextResponse.json({ error: 'Image generation not available for this API key. Please upgrade your Gemini API plan or try again.' }, { status: 422 })
    }
    const b64 = imgPart.inlineData.data

    if (wp_url && wp_username && wp_password) {
      const wpMediaId = await uploadToWordPress(b64, title, wp_url, wp_username, wp_password)
      if (article_id && wpMediaId && supabase) {
        await supabase.from('articles').update({ cover_image_alt: `Featured image for: ${title}` }).eq('id', article_id)
      }
      return NextResponse.json({ success: true, image_b64: b64, wp_media_id: wpMediaId, source: 'gemini-flash-image' })
    }
    return NextResponse.json({ success: true, image_b64: b64, source: 'gemini-flash-image' })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

async function uploadToWordPress(b64: string, title: string, wpUrl: string, wpUser: string, wpPass: string): Promise<number | null> {
  try {
    const base = wpUrl.replace(/\/$/, '')
    const auth = Buffer.from(`${wpUser}:${wpPass}`).toString('base64')
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}-${Date.now()}.jpg`
    const imgBuffer = Buffer.from(b64, 'base64')

    const uploadRes = await fetch(`${base}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      body: imgBuffer,
    })

    if (!uploadRes.ok) return null
    const mediaData = await uploadRes.json()
    return mediaData.id || null
  } catch {
    return null
  }
}
