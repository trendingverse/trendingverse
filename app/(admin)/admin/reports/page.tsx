import { ReportBuilder } from '@/components/admin/ReportBuilder'

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">📊 Reports</h1>
        <p className="text-sm text-ink-400 mt-1">
          Build custom ad-server reports — pick metrics and dimensions, filter, and export.
        </p>
      </div>
      <ReportBuilder />
    </div>
  )
}
