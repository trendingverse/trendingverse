// app/api/video/generate-assets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 120

// ── Concurrency-limited parallel executor ──────────────────────
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const current = idx++
      results[current] = await fn(items[current], current)
    }
  }
  const workers = Array(Math.min(limit, items.length)).fill(0).map(() => worker())
  await Promise.all(workers)
  return results
}

// ── Wrap raw PCM (Gemini TTS output) into a playable WAV data URI ──
function pcmToWavDataUri(pcmBase64: string, sampleRate = 24000, channels = 1, bitsPerSample = 16): string {
  const pcmBuffer = Buffer.from(pcmBase64, 'base64')
  const byteRate = (sampleRate * channels * bitsPerSample) / 8
  const blockAlign = (channels * bitsPerSample) / 8
  const dataSize = pcmBuffer.length
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)
  const wavBuffer = Buffer.concat([header, pcmBuffer])
  return `data:audio/wav;base64,${wavBuffer.toString('base64')}`
}

// ── Generate the scene-by-scene script ────────────────────────────
async function generateScript(title: string, content: string, geminiKey: string) {
  const prompt = `You are creating a short video script based on this news article, for YouTube and Instagram.

Title: ${title}
Content: ${content.slice(0, 1500)}

Break this into exactly 6 short scenes for a 30-45 second video:
- Scene 1: Hook — grab attention, state the headline/topic
- Scenes 2-5: Key facts/points from the article, one per scene
- Scene 6: Closing/summary line

For each scene return:
- narration: 1-2 short sentences, spoken aloud, natural conversational tone, 8-16 words
- caption: short on-screen text version, max 12 words
- image_prompt: a SHORT (1-2 sentence) visual description for a photorealistic photo illustrating this scene

CRITICAL RULES for image_prompt:
- NEVER describe the specific likeness/face of any real, named, identifiable person — even if mentioned in the article. Use generic, anonymous, or symbolic imagery instead (a building, an object, a generic crowd from a distance, a symbol related to the topic).
- Must read as a realistic photograph style, not illustration/cartoon/painting.
- No text, logos, or watermarks described in the image.

Return ONLY valid JSON, no markdown:
{"scenes":[{"narration":"...","caption":"...","image_prompt":"..."}]}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
      }),
    }
  )
  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const cleaned = raw.replace(/```json\n?|```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Could not parse script from Gemini response')
  const parsed = JSON.parse(match[0])
  return parsed.scenes || []
}

// ── Generate one scene's image (Nano Banana), compressed to lightweight JPEG ──
async function generateSceneImage(prompt: string, geminiKey: string): Promise<string | null> {
  try {
    const fullPrompt = `${prompt}

Style: photorealistic, natural lighting, professional editorial photography, no text overlays, no logos, no watermarks, no illustrated or cartoon style, no specific identifiable real people's faces.`

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
    let finalBuffer: Buffer = buffer
    try {
      const sharp = (await import('sharp')).default
      const out = await sharp(buffer).resize(1280, 720, { fit: 'cover' }).jpeg({ quality: 78 }).toBuffer()
      finalBuffer = Buffer.from(out)
    } catch { /* use original if sharp unavailable */ }

    return `data:image/jpeg;base64,${finalBuffer.toString('base64')}`
  } catch {
    return null
  }
}

// ── Generate one scene's voiceover audio ──────────────────────────
async function generateSceneAudio(text: string, geminiKey: string, voice: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Say in a clear, engaging news-anchor tone: ${text}` }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || 'Kore' } } },
          },
        }),
      }
    )
    const data = await res.json()
    if (data.error) return null
    const parts = data.candidates?.[0]?.content?.parts || []
    const audioPart = parts.find((p: any) => p.inlineData?.data)
    if (!audioPart) return null
    return pcmToWavDataUri(audioPart.inlineData.data)
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { article_id, include_voiceover, voice } = await req.json().catch(() => ({}))
  if (!article_id) return NextResponse.json({ error: 'article_id is required' }, { status: 400 })

  const { data: article } = await supabase
    .from('articles').select('title, excerpt, content').eq('id', article_id).single()
  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

  const geminiKey = process.env.GEMINI_API_KEY!
  const plainContent = (article.content || article.excerpt || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  try {
    const scriptScenes = await generateScript(article.title, plainContent, geminiKey)
    if (!scriptScenes.length) return NextResponse.json({ error: 'Script generation returned no scenes' }, { status: 500 })

    const sceneResults = await mapWithConcurrency(scriptScenes, 3, async (scene: any) => {
      const [image, audio] = await Promise.all([
        generateSceneImage(scene.image_prompt, geminiKey),
        include_voiceover ? generateSceneAudio(scene.narration, geminiKey, voice) : Promise.resolve(null),
      ])
      return {
        narration: scene.narration,
        caption: scene.caption,
        image,
        audio,
      }
    })

    return NextResponse.json({
      title: article.title,
      scenes: sceneResults,
      voiceover_included: !!include_voiceover,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
