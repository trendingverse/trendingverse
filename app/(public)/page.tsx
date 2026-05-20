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
          🔥 AI-powered content automation for publishers
        </div>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
          Generate, publish &amp; grow<br />your WordPress site on autopilot
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          TrendingVerse CMS detects trending topics, generates SEO-optimized articles with AI,
          fetches editorial photos, and publishes directly to your WordPress site — automatically, every day.
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
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-8 text-center">
          {[
            { value: '5 min', label: 'Setup time' },
            { value: '700+', label: 'Words per article' },
            { value: '100%', label: 'SEO optimized' },
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
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">Everything you need to dominate search</h2>
        <p className="text-gray-500 text-center mb-16">Built for news publishers, bloggers, and content teams</p>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: '🔥', title: 'Trending topic detection', desc: 'Real-time trending topics from India, US, UK and Global via NewsAPI and AI detection.' },
            { icon: '✦', title: 'AI article generation', desc: 'Gemini AI writes 700-900 word, Google Discover-ready articles with proper SEO structure.' },
            { icon: '📸', title: 'Auto editorial photos', desc: 'Automatically fetches relevant professional photos from Pexels and uploads to WordPress.' },
            { icon: '⬆', title: 'One-click WordPress push', desc: 'Push articles directly to your WordPress site with featured image, categories, and SEO meta.' },
            { icon: '⏰', title: 'Daily auto-publish cron', desc: 'Set and forget — your site gets fresh content every morning without you lifting a finger.' },
            { icon: '🛡️', title: 'Duplicate prevention', desc: 'Smart duplicate detection checks WordPress before publishing to avoid content conflicts.' },
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
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">Simple, transparent pricing</h2>
          <p className="text-gray-500 text-center mb-16">Start free, upgrade when you need more</p>
          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            {/* Free */}
            <div className="bg-white border border-gray-200 rounded-2xl p-8">
              <div className="text-sm font-medium text-gray-500 mb-2">Free</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">$0</div>
              <div className="text-sm text-gray-400 mb-8">Forever free</div>
              <ul className="space-y-3 mb-8">
                {['5 articles per day', '1 WordPress site', 'AI article generation', 'Pexels photo auto-fetch', 'Manual publish only', 'Basic SEO scoring'].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-700">
                    <span className="text-green-500">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block text-center py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Get started free
              </Link>
            </div>
            {/* Pro */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs font-medium px-3 py-1 rounded-full">Most popular</div>
              <div className="text-sm font-medium text-gray-400 mb-2">Pro</div>
              <div className="text-4xl font-bold text-white mb-1">$9.99</div>
              <div className="text-sm text-gray-500 mb-8">per month · ~₹830/mo</div>
              <ul className="space-y-3 mb-8">
                {['Unlimited articles', 'Multiple WordPress sites', 'Daily auto-publish cron', 'Google Trends integration', 'Analytics dashboard', 'Priority support'].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-300">
                    <span className="text-red-400">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/signup?plan=pro" className="block text-center py-3 bg-red-500 rounded-xl text-sm font-medium text-white hover:bg-red-600 transition-colors">
                Start Pro free trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to automate your content?</h2>
        <p className="text-gray-500 mb-8">Join publishers already using TrendingVerse CMS to grow their traffic on autopilot.</p>
        <Link href="/signup" className="inline-flex px-8 py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-colors">
          Get started free →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} TrendingVerse CMS · Built for publishers
      </footer>
    </div>
  )
}
