'use client'
import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'

interface Scene {
  narration: string
  caption: string
  image: string | null
  audio: string | null
}
interface ArticleOption { id: string; title: string }

const VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Zephyr']

export function VideoGenerator() {
  const [articles, setArticles] = useState<ArticleOption[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [includeVoiceover, setIncludeVoiceover] = useState(true)
  const [voice, setVoice] = useState('Kore')
  const [generating, setGenerating] = useState(false)
  const [scenes, setScenes] = useState<Scene[] | null>(null)
  const [videoTitle, setVideoTitle] = useState('')
  const [format, setFormat] = useState<'16:9' | '9:16'>('16:9')
  const [playing, setPlaying] = useState(false)
  const [recording, setRecording] = useState(false)
  const [currentScene, setCurrentScene] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recordedChunks = useRef<Blob[]>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const stopRequested = useRef(false)

  useEffect(() => { fetchArticles() }, [])

  async function fetchArticles() {
    try {
      const res = await fetch('/api/articles?status=published&limit=50')
      if (res.ok) {
        const data = await res.json()
        const list = Array.isArray(data) ? data : (data.articles || data.data || [])
        setArticles(list.map((a: any) => ({ id: a.id, title: a.title })))
      }
    } catch { /* silent */ }
  }

  async function generateVideo() {
    if (!selectedId) { toast.error('Select an article first'); return }
    setGenerating(true)
    setScenes(null)
    try {
      const res = await fetch('/api/ai/video/generate-assets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: selectedId, include_voiceover: includeVoiceover, voice }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setScenes(data.scenes)
      setVideoTitle(data.title)
      toast.success(`${data.scenes.length} scenes generated!`)
    } catch (e) {
      toast.error((e as Error).message)
    }
    setGenerating(false)
  }

  const dims = format === '16:9' ? { w: 1280, h: 720 } : { w: 720, h: 1280 }

  function drawScene(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, caption: string, progress: number) {
    const { w, h } = dims
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w, h)

    if (img) {
      const scale = 1 + 0.12 * progress // slow Ken Burns zoom
      const imgRatio = img.width / img.height
      const canvasRatio = w / h
      let drawW: number, drawH: number
      if (imgRatio > canvasRatio) {
        drawH = h * scale
        drawW = drawH * imgRatio
      } else {
        drawW = w * scale
        drawH = drawW / imgRatio
      }
      const dx = (w - drawW) / 2
      const dy = (h - drawH) / 2
      ctx.drawImage(img, dx, dy, drawW, drawH)
    }

    // Caption bar
    const barHeight = h * 0.2
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, h - barHeight, w, barHeight)

    ctx.fillStyle = '#fff'
    const fontSize = Math.round(h * 0.034)
    ctx.font = `bold ${fontSize}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const maxWidth = w * 0.88
    const words = caption.split(' ')
    let line = ''
    const lines: string[] = []
    for (const word of words) {
      const test = line + word + ' '
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line.trim())
        line = word + ' '
      } else {
        line = test
      }
    }
    if (line) lines.push(line.trim())

    const lineHeight = fontSize * 1.3
    const startY = h - barHeight / 2 - ((lines.length - 1) * lineHeight) / 2
    lines.forEach((l, i) => ctx.fillText(l, w / 2, startY + i * lineHeight))
  }

  function loadImage(src: string | null): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      if (!src) { resolve(null); return }
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = src
    })
  }

  async function playSequence(record: boolean) {
    if (!scenes || !canvasRef.current) return
    const canvas = canvasRef.current
    canvas.width = dims.w
    canvas.height = dims.h
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    stopRequested.current = false
    let audioCtx: AudioContext | null = null
    let audioDest: MediaStreamAudioDestinationNode | null = null

    if (record) {
      const videoStream = canvas.captureStream(30)
      let combinedStream: MediaStream = videoStream

      if (includeVoiceover) {
        audioCtx = new AudioContext()
        audioDest = audioCtx.createMediaStreamDestination()
        combinedStream = new MediaStream([
          ...videoStream.getVideoTracks(),
          ...audioDest.stream.getAudioTracks(),
        ])
      }

      recordedChunks.current = []
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm'
      const mr = new MediaRecorder(combinedStream, { mimeType })
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(recordedChunks.current, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${videoTitle.slice(0, 40).replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '-')}-${format.replace(':', 'x')}.webm`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('Video downloaded!')
        setRecording(false)
      }
      mediaRecorderRef.current = mr
      mr.start()
      setRecording(true)
    }

    setPlaying(true)

    for (let i = 0; i < scenes.length; i++) {
      if (stopRequested.current) break
      setCurrentScene(i)
      const scene = scenes[i]
      const img = await loadImage(scene.image)

      let audioEl: HTMLAudioElement | null = null
      let sceneDuration = Math.min(7000, Math.max(3000, scene.caption.length * 90))

      if (includeVoiceover && scene.audio) {
        audioEl = new Audio(scene.audio)
        audioEl.crossOrigin = 'anonymous'
        if (record && audioCtx && audioDest) {
          try {
            const source = audioCtx.createMediaElementSource(audioEl)
            source.connect(audioDest)
          } catch { /* some browsers disallow re-wrapping — continue without audio routing */ }
        }
        await new Promise<void>(resolve => {
          const done = () => resolve()
          audioEl!.onloadedmetadata = () => {
            sceneDuration = Math.max(2000, (audioEl!.duration || 3) * 1000 + 300)
            done()
          }
          audioEl!.onerror = done
          setTimeout(done, 1500) // safety timeout
        })
        audioEl.play().catch(() => {})
      }

      const startTime = performance.now()
      await new Promise<void>(resolve => {
        function frame() {
          const elapsed = performance.now() - startTime
          const progress = Math.min(1, elapsed / sceneDuration)
          drawScene(ctx, img, scene.caption, progress)
          if (elapsed < sceneDuration && !stopRequested.current) {
            requestAnimationFrame(frame)
          } else {
            resolve()
          }
        }
        frame()
      })

      if (audioEl) audioEl.pause()
    }

    setPlaying(false)
    if (record && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
    }
  }

  function stopPlayback() {
    stopRequested.current = true
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="font-display text-xl font-bold text-ink-950">🎬 Article to Video</h2>
        <p className="text-sm text-ink-400 mt-1">Turn a published article into a short video for YouTube or Instagram</p>
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <label className="label">Select Article</label>
          <select className="input" value={selectedId} onChange={e => setSelectedId(e.target.value)} disabled={generating}>
            <option value="">Choose an article...</option>
            {articles.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" checked={includeVoiceover} onChange={e => setIncludeVoiceover(e.target.checked)}
            disabled={generating} className="w-4 h-4 accent-accent" />
          <label className="text-sm text-ink-700">Include AI voiceover narration</label>
        </div>

        {includeVoiceover && (
          <div>
            <label className="label">Voice</label>
            <select className="input w-48" value={voice} onChange={e => setVoice(e.target.value)} disabled={generating}>
              {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        )}

        <button onClick={generateVideo} disabled={generating || !selectedId} className="btn-primary">
          {generating ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating script, images{includeVoiceover ? ' & voiceover' : ''}...
            </span>
          ) : '✦ Generate Video Assets'}
        </button>
        <p className="text-xs text-ink-400">Usually takes 20-60 seconds depending on scene count and voiceover.</p>
      </div>

      {scenes && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold text-ink-900 truncate max-w-xs">{videoTitle}</h3>
            <div className="flex gap-1 p-1 bg-ink-100 rounded-xl">
              {(['16:9', '9:16'] as const).map(f => (
                <button key={f} onClick={() => setFormat(f)} disabled={playing || recording}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${format === f ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
                  {f === '16:9' ? '📺 YouTube' : '📱 Reels/Shorts'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-center bg-ink-950 rounded-xl p-4">
            <canvas ref={canvasRef}
              style={{ maxWidth: '100%', maxHeight: 480, aspectRatio: format === '16:9' ? '16/9' : '9/16', background: '#000', borderRadius: 8 }} />
          </div>

          <p className="text-xs text-ink-400 text-center">
            Scene {currentScene + 1} of {scenes.length}{playing ? ' — playing...' : recording ? ' — recording...' : ''}
          </p>

          <div className="flex gap-3">
            {!playing && !recording ? (
              <>
                <button onClick={() => playSequence(false)}
                  className="flex-1 px-4 py-2.5 bg-ink-100 text-ink-700 rounded-xl font-medium hover:bg-ink-200">
                  ▶ Preview
                </button>
                <button onClick={() => playSequence(true)}
                  className="flex-1 btn-primary">
                  ⬇ Generate & Download Video
                </button>
              </>
            ) : (
              <button onClick={stopPlayback}
                className="flex-1 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100">
                ⏹ Stop
              </button>
            )}
          </div>
          <p className="text-xs text-ink-400 text-center">
            Downloads as .webm (works for direct upload to YouTube/Instagram). Recording takes roughly as long as the video itself since it captures in real time. Best supported in Chrome/Edge.
          </p>
        </div>
      )}
    </div>
  )
}
