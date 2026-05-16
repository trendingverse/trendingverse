'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-2">
      <div className="text-center p-8">
        <p className="font-display text-4xl font-bold text-accent mb-3">Oops!</p>
        <p className="text-ink-500 mb-6">{error.message || 'Something went wrong.'}</p>
        <button onClick={reset} className="btn-primary">Try Again</button>
      </div>
    </div>
  )
}
