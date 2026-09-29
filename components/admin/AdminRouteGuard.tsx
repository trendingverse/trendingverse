'use client'
// components/admin/AdminRouteGuard.tsx
// Keeps publisher logins out of admin-only sections: they're sent back to the
// dashboard and the page content is never displayed. (Data itself is protected
// by row-level security in the database; this guard is the navigation layer.)
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

// Admin-only sections (prefix match). Earnings (/admin/revenue) stays open:
// it already shows publishers only their own share.
export const PUBLISHER_BLOCKED = [
  '/admin/monetization',
  '/admin/partners',
  '/admin/direct-ads',
  '/admin/reports',
  '/admin/reporting-apis',
  '/admin/site-scripts',
  '/admin/outreach',
  '/admin/trends',
  '/admin/authors',
  '/admin/author-fix',
  '/admin/audience',
  '/admin/advertisers',
  '/admin/users',
  '/admin/publishers',
]

// Pro-only sections: open for these packages, an upgrade message for the rest
export const ANALYTICS_PLANS = ['pro', 'byoak', 'agency']
const PRO_ONLY = ['/admin/analytics']

export function isBlockedForPublisher(path: string) {
  return PUBLISHER_BLOCKED.some(p => path === p || path.startsWith(p + '/'))
}

export function AdminRouteGuard({ isPublisher, plan = 'free', children }: { isPublisher: boolean; plan?: string; children: React.ReactNode }) {
  const path = usePathname() || ''
  const router = useRouter()
  const blocked = isPublisher && isBlockedForPublisher(path)
  const needsPro = isPublisher && PRO_ONLY.some(p => path === p || path.startsWith(p + '/')) && !ANALYTICS_PLANS.includes(plan)

  useEffect(() => {
    if (blocked) router.replace('/admin')
  }, [blocked, router])

  if (needsPro) {
    return (
      <div className="card p-8 text-center max-w-lg mx-auto" style={{ marginTop: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📈</div>
        <h2 className="font-bold text-ink-900 text-xl mb-2">Subscribe to Pro to unlock Analytics</h2>
        <p className="text-ink-500 text-sm mb-6 leading-relaxed">
          See your Google Search Console and Google Analytics data right here — search clicks, impressions,
          top queries, visitors and traffic sources for your site, alongside your articles.
        </p>
        <a href="/pricing" className="inline-block bg-red-500 text-white font-semibold px-6 py-3 rounded-xl hover:bg-red-600 transition-colors">
          View Pro plan →
        </a>
        <p className="text-xs text-ink-400 mt-3">Your current package: {plan}</p>
      </div>
    )
  }

  if (blocked) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--txt-3)', fontSize: 14 }}>This section isn’t available on your account. Taking you to your dashboard…</div>
  }
  return <>{children}</>
}
