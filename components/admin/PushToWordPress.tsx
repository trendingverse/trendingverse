'use client'
import { useState } from 'react'

interface Props {
  articleId: string
  articleTitle: string
}

export function PushToWordPress({ articleId, articleTitle }: Props) {
  const [status, setStatus] = useState<'idle' | 'pushing' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [wpLink, setWpLink] = useState('')

  async function push() {
    // Get WP credentials from settings inputs
    const wpUrl = (document.getElementById('wp_url') as HTMLInputElement)?.value ||
      prompt('WordPress URL (e.g. https://trendingverse.online)')
    const wpUsername = (document.getElementById('wp_username') as HTMLInputElement)?.value ||
      prompt('WordPress Username')
    const wpPassword = (document.getElementById('wp_password') as HTMLInputElement)?.value ||
      prompt('WordPress Application Password')

    if (!wpUrl || !wpUsername || !wpPassword) {
      setStatus('error')
      setMessage('WordPress credentials missing. Go to Settings → Integrations and fill in the WordPress fields.')
      return
    }

    setStatus('pushing')
    setMessage('Pushing to WordPress...')

    try {
      const res = await fetch('/api/wordpress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: articleId,
          wp_url: wpUrl,
          wp_username: wpUsername,
          wp_password: wpPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'WordPress push failed')
      setStatus('success')
      setWpLink(data.wp_url)
      setMessage(`Published! Post ID: ${data.wp_post_id}`)
    } catch (e) {
      setStatus('error')
      setMessage((e as Error).message)
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={push}
        disabled={status === 'pushing'}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {status === 'pushing' ? (
          <><span className="animate-spin">⟳</span> Pushing...</>
        ) : (
          <><span>⬆</span> Push to WordPress</>
        )}
      </button>
      {message && (
        <p className={`mt-1 text-xs ${status === 'success' ? 'text-green-600' : status === 'error' ? 'text-red-500' : 'text-ink-400'}`}>
          {message}
          {wpLink && (
            <a href={wpLink} target="_blank" rel="noopener noreferrer"
              className="ml-2 underline text-blue-600">View on site →</a>
          )}
        </p>
      )}
    </div>
  )
}
