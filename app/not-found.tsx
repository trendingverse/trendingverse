import Link from 'next/link'
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-2">
      <div className="text-center p-8">
        <p className="font-display text-8xl font-bold text-ink-100 mb-2">404</p>
        <h1 className="font-display text-2xl font-bold text-ink-900 mb-2">Page Not Found</h1>
        <p className="text-ink-500 mb-6">This article or page doesn't exist.</p>
        <Link href="/" className="btn-primary">← Back to Home</Link>
      </div>
    </div>
  )
}
