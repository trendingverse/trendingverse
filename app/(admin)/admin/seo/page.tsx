import { SEORewriter } from '@/components/admin/SEORewriter'

export default function SEOPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">◈ SEO Rewriter</h1>
        <p className="text-sm text-ink-400 mt-1">
          AI rewrites every article headline for Google Discover + SEO — review, approve and push to WordPress in one click
        </p>
      </div>
      <SEORewriter />
    </div>
  )
}
