import { VideoGenerator } from '@/components/admin/VideoGenerator'

export default function VideoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">🎬 Article to Video</h1>
        <p className="text-sm text-ink-400 mt-1">Turn a published article into a short video for YouTube or Instagram</p>
      </div>
      <VideoGenerator />
    </div>
  )
}
