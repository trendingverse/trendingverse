import { RevenueDashboard } from '@/components/admin/RevenueDashboard'

export default function RevenuePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">💵 Network Revenue</h1>
        <p className="text-sm text-ink-400 mt-1">
          Revenue pulled from your ad networks' reporting APIs. Filter by network, site, and date.
        </p>
      </div>
      <RevenueDashboard />
    </div>
  )
}
