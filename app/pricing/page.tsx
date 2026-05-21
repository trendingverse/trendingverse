'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function PricingPage() {
  const [currency, setCurrency] = useState<'usd'|'inr'>('usd')
  const [loading, setLoading] = useState(false)

  async function subscribe() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert(data.error || 'Something went wrong')
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <Link href="/" className="font-bold text-xl">Trending<span className="text-red-500">Verse</span> <span className="text-xs font-normal text-gray-400">CMS</span></Link>
          <h1 className="text-4xl font-bold text-gray-900 mt-6 mb-3">Choose your plan</h1>
          <p className="text-gray-500">Start free, upgrade when you need more power</p>

          {/* Currency toggle */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <button onClick={() => setCurrency('usd')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currency === 'usd' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              $ USD
            </button>
            <button onClick={() => setCurrency('inr')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currency === 'inr' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              ₹ INR
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          {/* Free */}
          <div className="bg-white border border-gray-200 rounded-2xl p-8">
            <div className="text-sm font-medium text-gray-500 mb-2">Free</div>
            <div className="text-4xl font-bold text-gray-900 mb-1">$0</div>
            <div className="text-sm text-gray-400 mb-8">Forever free</div>
            <ul className="space-y-3 mb-8">
              {[
                '5 articles per day',
                '1 WordPress site',
                'AI article generation',
                'Pexels photo auto-fetch',
                'Manual publish only',
                '10 languages supported',
                'Basic analytics',
              ].map(f => (
                <li key={f} className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="text-green-500 font-bold">✓</span>{f}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="block text-center py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Get started free
            </Link>
          </div>

          {/* Pro */}
          <div className="bg-gray-900 rounded-2xl p-8 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs font-medium px-3 py-1 rounded-full">Most popular</div>
            <div className="text-sm font-medium text-gray-400 mb-2">Pro</div>
            <div className="text-4xl font-bold text-white mb-1">
              {currency === 'usd' ? '$9.99' : '₹830'}
            </div>
            <div className="text-sm text-gray-500 mb-8">
              per month · {currency === 'usd' ? '~₹830/mo' : '~$9.99/mo'}
            </div>
            <ul className="space-y-3 mb-8">
              {[
                'Unlimited articles',
                'Multiple WordPress sites',
                'Daily auto-publish cron',
                'NewsAPI India trends',
                'Full analytics dashboard',
                'Cron run history',
                'Priority support',
                'All 10 Indian languages',
              ].map(f => (
                <li key={f} className="flex items-center gap-3 text-sm text-gray-300">
                  <span className="text-red-400 font-bold">✓</span>{f}
                </li>
              ))}
            </ul>
            <button
              onClick={subscribe}
              disabled={loading}
              className="w-full py-3 bg-red-500 rounded-xl text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Redirecting...' : `Subscribe for ${currency === 'usd' ? '$9.99' : '₹830'}/mo`}
            </button>
            <p className="text-xs text-gray-500 text-center mt-3">Cancel anytime · Instant access</p>
          </div>
        </div>

        <div className="text-center mt-8 text-sm text-gray-400">
          <p>Payments secured by Stripe · Indian cards accepted · UPI coming soon</p>
        </div>
      </div>
    </div>
  )
}
