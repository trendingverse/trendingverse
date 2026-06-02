import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="font-bold text-xl">Trending<span className="text-red-500">Verse</span> <span className="text-xs font-normal text-gray-400 ml-1">CMS</span></div>
        <div className="flex items-center gap-6">
          <a href="#features" className="text-sm text-gray-600 hover:text-gray-900">Features</a>
          <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900">Pricing</a>
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">Sign in</Link>
          <Link href="/signup" className="text-sm px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Get started free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 text-xs font-medium px-3 py-1 rounded-full mb-6">
          🔥 AI-powered CMS &amp; Programmatic Ad Network for Indian Publishers
        </div>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
          Publish smarter.<br /><span className="text-red-500">Monetize automatically.</span>
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          Generate AI articles in 10 Indian languages, inject programmatic ads into all your WordPress articles, and track revenue — all from one dashboard.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/signup" className="px-8 py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-colors text-lg">
            Start free — no credit card
          </Link>
          <Link href="/admin" className="px-8 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-lg">
            View demo →
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-4">Free plan includes 5 articles/day · No credit card required</p>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-100 py-12">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-4 gap-8 text-center">
          {[
            { value: '10+', label: 'Indian Languages' },
            { value: '3', label: 'AI Models' },
            { value: '100%', label: 'Auto Ad Injection' },
            { value: '₹0', label: 'To Start' },
          ].map(s => (
            <div key={s.value}>
              <div className="text-3xl font-bold text-gray-900">{s.value}</div>
              <div className="text-sm text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">Everything a publisher needs</h2>
        <p className="text-gray-500 text-center mb-16">From article generation to revenue — one platform</p>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: '✦', title: 'AI Article Generator', desc: 'Generate full SEO-optimized articles in Kannada, Hindi, Tamil, Telugu and 6 more languages using Gemini, GPT-4o or Claude.' },
            { icon: '📋', title: 'Paste & Enrich', desc: 'Paste any WhatsApp article — AI generates SEO title, meta, keywords, Google Discover headline and readability score in the same language.' },
            { icon: '🚀', title: 'WordPress Auto-Publish', desc: 'Push articles with auto-fetched Pexels photos, Yoast SEO meta and duplicate protection in one click.' },
            { icon: '💰', title: 'Programmatic Ad Network', desc: 'Create ad units, assign to publishers with custom revenue splits. Ads auto-inject into all articles — header, in-content, footer.' },
            { icon: '🔌', title: 'WordPress Ads Plugin', desc: 'TrendingVerse Ads plugin auto-fetches ad codes and injects into all existing articles. Auto-updates — no manual ZIP sharing.' },
            { icon: '📡', title: 'Revenue Dashboard', desc: 'Live impressions, clicks, CTR, eCPM and earnings with date filters, publisher breakdown and CSV/Excel/PDF export.' },
            { icon: '🔍', title: 'Google Search Console', desc: 'Connect GSC per publisher — clicks, impressions, keyword rankings and Discover traffic in one dashboard.' },
            { icon: '📈', title: 'Google Analytics 4', desc: 'Sessions, pageviews, traffic sources and device breakdown — each publisher connects their own GA4 property.' },
            { icon: '⏰', title: 'Daily Auto-Publish Cron', desc: 'Set and forget — your site gets fresh trending content every morning at 9 AM IST without lifting a finger.' },
          ].map(f => (
            <div key={f.title} className="p-6 border border-gray-100 rounded-2xl hover:shadow-md transition-shadow">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-gray-50 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3">Publisher-first pricing</h2>
          <p className="text-gray-500 text-center mb-3">Every rupee you spend comes back multiplied</p>
          <p className="text-center text-sm text-green-600 font-medium mb-12">
            Publishers earning ₹3,000/mo from ads pay just ₹399 — a 7x return
          </p>

          <div className="grid md:grid-cols-4 gap-5">

            {/* Free */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Free</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">₹0</div>
              <div className="text-sm text-gray-400 mb-6">Forever free · no card</div>
              <ul className="space-y-2 mb-8 flex-1">
                {[
                  '5 AI articles/day',
                  '1 WordPress site',
                  'Own AI API key',
                  'SEO Engine',
                  'Paste & Enrich',
                  'Basic analytics',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-green-500 font-bold shrink-0 mt-0.5">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block text-center py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Get started free
              </Link>
            </div>

            {/* Growth */}
            <div className="bg-white border-2 border-blue-200 rounded-2xl p-6 flex flex-col">
              <div className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-2">Growth</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">₹399</div>
              <div className="text-sm text-gray-400 mb-6">per month · ~$4.99/mo</div>
              <ul className="space-y-2 mb-8 flex-1">
                {[
                  '50 AI articles/day',
                  '3 WordPress sites',
                  'Own AI API key',
                  'Auto-publish cron',
                  'Google Search Console',
                  'Google Analytics 4',
                  'Basic ad injection',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-blue-500 font-bold shrink-0 mt-0.5">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/signup?plan=growth" className="block text-center py-2.5 bg-blue-600 rounded-xl text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                Get Growth
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-gray-900 rounded-2xl p-6 relative flex flex-col">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                🔥 Most popular
              </div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pro</div>
              <div className="text-4xl font-bold text-white mb-1">₹799</div>
              <div className="text-sm text-gray-500 mb-6">per month · ~$9.99/mo</div>
              <ul className="space-y-2 mb-8 flex-1">
                {[
                  'Unlimited AI articles',
                  'Unlimited WP sites',
                  'Platform AI keys included',
                  'GPT-4o + Claude + Gemini',
                  'Full ad network',
                  'Revenue dashboard',
                  'WP Ads plugin',
                  'Publisher management',
                  'Priority support',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-red-400 font-bold shrink-0 mt-0.5">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/signup?plan=pro" className="block text-center py-2.5 bg-red-500 rounded-xl text-sm font-medium text-white hover:bg-red-600 transition-colors">
                Get Pro
              </Link>
              <p className="text-xs text-gray-600 text-center mt-2">UPI · Cards · Net Banking</p>
            </div>

            {/* Agency */}
            <div className="bg-white border-2 border-violet-200 rounded-2xl p-6 flex flex-col">
              <div className="text-xs font-semibold text-violet-500 uppercase tracking-wide mb-2">Agency</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">₹1,999</div>
              <div className="text-sm text-gray-400 mb-6">per month · ~$24.99/mo</div>
              <ul className="space-y-2 mb-8 flex-1">
                {[
                  'Everything in Pro',
                  'Unlimited publishers',
                  'Platform AI keys',
                  'White-label ready',
                  'Advanced analytics',
                  'Dedicated support',
                  'Early access',
                ].map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-violet-500 font-bold shrink-0 mt-0.5">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/signup?plan=agency" className="block text-center py-2.5 bg-violet-600 rounded-xl text-sm font-medium text-white hover:bg-violet-700 transition-colors">
                Get Agency
              </Link>
            </div>

          </div>

          {/* ROI callout */}
          <div className="mt-10 p-5 bg-green-50 border border-green-100 rounded-2xl text-center">
            <p className="text-sm text-green-800 font-medium mb-2">💰 The math works in your favour</p>
            <div className="flex items-center justify-center gap-8 flex-wrap text-xs text-green-700">
              <span>Growth ₹399 · earn ₹2,000/mo from ads → <strong>5x ROI</strong></span>
              <span>Pro ₹799 · earn ₹5,000/mo from ads → <strong>6x ROI</strong></span>
              <span>Agency ₹1,999 · earn ₹20,000/mo → <strong>10x ROI</strong></span>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-gray-400">
            100% secure payments · Indian payment methods · Cancel anytime ·{' '}
            <Link href="/pricing" className="text-red-500 hover:underline">Full feature comparison →</Link>
          </div>
        </div>
      </section>

      {/* Language support */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-100 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-3">Built for Indian publishers 🇮🇳</h3>
          <p className="text-gray-500 mb-6">Generate articles in 10 regional languages — reach audiences in their native language</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {['English','हिंदी','தமிழ்','తెలుగు','ಕನ್ನಡ','മലയാളം','मराठी','ગુજરાતી','বাংলা','ਪੰਜਾਬੀ'].map(lang => (
              <span key={lang} className="px-3 py-1.5 bg-white border border-orange-100 rounded-full text-sm font-medium text-gray-700">
                {lang}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to build your publisher network?</h2>
        <p className="text-gray-500 mb-8">Start free. Onboard publishers. Inject ads. Track revenue. All from one dashboard.</p>
        <Link href="/signup" className="inline-flex px-8 py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-colors">
          Get started free →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} TrendingVerse · Made in India 🇮🇳 ·{' '}
        <Link href="/pricing" className="hover:text-gray-600">Pricing</Link> ·{' '}
        <Link href="/login" className="hover:text-gray-600">Sign in</Link> ·{' '}
        <a href="mailto:support@trendingverse.online" className="hover:text-gray-600">Support</a>
      </footer>
    </div>
  )
}
