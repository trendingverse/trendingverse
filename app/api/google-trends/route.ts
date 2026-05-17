import { TrendingTopicsPanel } from '@/components/admin/TrendingTopicsPanel'

export default function TrendsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">🔥 Google Trends</h1>
        <p className="text-sm text-ink-400 mt-1">
          Real-time trending topics from India, US, UK and Global — generate articles instantly
        </p>
      </div>
      <TrendingTopicsPanel />
    </div>
  )
}
