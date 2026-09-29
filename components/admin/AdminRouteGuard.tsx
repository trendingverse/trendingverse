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
  '/admin/analytics',
  '/admin/trends',
  '/admin/authors',
  '/admin/author-fix',
  '/admin/audience',
  '/admin/advertisers',
  '/admin/users',
  '/admin/publishers',
]

export function isBlockedForPublisher(path: string) {
  return PUBLISHER_BLOCKED.some(p => path === p || path.startsWith(p + '/'))
}

export function AdminRouteGuard({ isPublisher, children }: { isPublisher: boolean; children: React.ReactNode }) {
  const path = usePathname() || ''
  const router = useRouter()
  const blocked = isPublisher && isBlockedForPublisher(path)

  useEffect(() => {
    if (blocked) router.replace('/admin')
  }, [blocked, router])

  if (blocked) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--txt-3)', fontSize: 14 }}>This section isn’t available on your account. Taking you to your dashboard…</div>
  }
  return <>{children}</>
}
