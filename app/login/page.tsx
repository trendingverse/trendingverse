import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* Nav */}
      <nav className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-lg">Trending<span className="text-red-500">Verse</span></span>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-500">
            <a href="#features" className="hover:text-gray-900">Features</a>
            <a href="#publishers" className="hover:text-gray-900">For Publishers</a>
            <a href="#monetization" className="hover:text-gray-900">Monetization</a>
            <Link href="/pricing" className="hover:text-gray-900">Pricing</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">Sign in</Link>
            <Link href="/signup" className="text-sm bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 font-medium transition-colors">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
          AI-Powered CMS for Indian Publishers
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight mb-6 max-w-3xl mx-auto">
          Publish smarter.<br />
          <span className="text-red-500">Monetize automatically.</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Generate AI articles in 10 Indian languages, inject programmatic ads into all your WordPress articles, and track revenue — all from one dashboard.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/signup"
            className="bg-red-500 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-red-600 transition-colors text-sm">
            Start for free →
          </Link>
          <Link href="/pricing"
            className="bg-gray-50 text-gray-700 px-8 py-3.5 rounded-xl font-semibold hover:bg-gray-100 transition-colors text-sm border border-gray-200">
            View pricing
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-4">No credit card required · Free forever plan available</p>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-3xl mx-auto">
          {[
            { value: '10+', label: 'Indian Languages' },
            { value: '3', label: 'AI Models' },
            { value: '100%', label: 'Auto Ad Injection' },
            { value: '₹0', label: 'to start' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything a publisher needs</h2>
            <p className="text-gray-500">From article generation to revenue — one platform</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: '✦',
                title: 'AI Article Generator',
                desc: 'Generate full SEO-optimized articles in Kannada, Hindi, Tamil, Telugu and 6 more languages using Gemini, GPT-4o or Claude.',
                color: 'bg-violet-50 text-violet-600',
              },
              {
                icon: '📋',
                title: 'Paste & Enrich',
                desc: 'Publisher pastes a WhatsApp article → AI generates SEO title, meta, keywords, Google Discover headline and readability score without touching the original.',
                color: 'bg-blue-50 text-blue-600',
              },
              {
                icon: '🚀',
                title: 'WordPress Auto-Publish',
                desc: 'Push articles to any WordPress site with auto-fetched Pexels photos, Yoast SEO meta, duplicate protection and ad injection in one click.',
                color: 'bg-green-50 text-green-600',
              },
              {
                icon: '💰',
                title: 'Programmatic Ad Network',
                desc: 'Create ad units, assign to publishers with custom revenue splits. Ads auto-inject into all articles — header, in-content after any paragraph, footer.',
                color: 'bg-amber-50 text-amber-600',
              },
              {
                icon: '🔌',
                title: 'WordPress Ads Plugin',
                desc: 'Distribute the TrendingVerse Ads plugin to publishers. It auto-fetches ad codes from your CMS and injects into all existing articles — no manual work.',
                color: 'bg-red-50 text-red-600',
              },
              {
                icon: '📡',
                title: 'Adsterra Revenue Dashboard',
                desc: 'Live impressions, clicks, CTR, eCPM and revenue from Adsterra with custom date ranges, by-publisher breakdown and CSV/Excel/PDF/email export.',
                color: 'bg-teal-50 text-teal-600',
              },
              {
                icon: '🔍',
                title: 'Google Search Console',
                desc: 'Connect GSC per publisher — clicks, impressions, keyword rankings, top pages and Discover traffic all in one dashboard.',
                color: 'bg-indigo-50 text-indigo-600',
              },
              {
                icon: '📈',
                title: 'Google Analytics 4',
                desc: 'Sessions, pageviews, traffic sources and device breakdown — each publisher connects their own GA4 property.',
                color: 'bg-pink-50 text-pink-600',
              },
              {
                icon: '🔥',
                title: 'Trending Topics',
                desc: 'Real-time trending topics from GNews for India, US, UK and Global. Generate articles on what\'s trending right now in one click.',
                color: 'bg-orange-50 text-orange-600',
              },
            ].map(f => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className={`w-10 h-10 rounded-xl ${f.color} flex items-center justify-center text-lg font-bold mb-4`}>
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For publishers */}
      <section id="publishers" className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-xs font-semibold text-red-500 uppercase tracking-wide">For Publishers</span>
              <h2 className="text-3xl font-bold text-gray-900 mt-3 mb-5">
                No AdSense approval needed
              </h2>
              <p className="text-gray-500 leading-relaxed mb-6">
                Publishers who haven't met AdSense's traffic requirements can still earn from programmatic ads under your TrendingVerse network. You get approved once — all your publishers earn under your umbrella.
              </p>
              <ul className="space-y-3">
                {[
                  'Install TrendingVerse Ads plugin — one-time setup',
                  'Plugin auto-fetches latest ad codes every hour',
                  'Ads inject into all existing articles automatically',
                  'Revenue tracked per publisher with your custom split',
                  'Plugin auto-updates — no manual ZIP sharing ever',
                ].map(item => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                    <span className="text-green-500 font-bold shrink-0 mt-0.5">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="inline-block mt-8 bg-red-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-red-600 transition-colors text-sm">
                Onboard your first publisher →
              </Link>
            </div>
            <div className="bg-gray-900 rounded-2xl p-6 font-mono text-xs text-gray-300 space-y-2">
              <p className="text-gray-500 mb-4">// Publisher flow</p>
              <p><span className="text-green-400">1.</span> Install TrendingVerse Ads plugin</p>
              <p><span className="text-green-400">2.</span> Enter publisher API key</p>
              <p><span className="text-green-400">3.</span> Plugin connects to CMS ✓</p>
              <p className="text-gray-500 mt-4 mb-2">// What happens automatically</p>
              <p><span className="text-blue-400">→</span> Fetches ad codes from CMS</p>
              <p><span className="text-blue-400">→</span> Injects header ad before content</p>
              <p><span className="text-blue-400">→</span> Injects in-content ad after ¶2</p>
              <p><span className="text-blue-400">→</span> Injects footer ad after content</p>
              <p><span className="text-blue-400">→</span> Works on ALL existing articles</p>
              <p><span className="text-blue-400">→</span> Auto-refreshes every hour</p>
              <p className="text-gray-500 mt-4 mb-2">// Revenue</p>
              <p><span className="text-amber-400">Publisher:</span> 70% of revenue</p>
              <p><span className="text-red-400">TrendingVerse:</span> 30% platform fee</p>
            </div>
          </div>
        </div>
      </section>

      {/* Monetization */}
      <section id="monetization" className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Monetization</span>
          <h2 className="text-3xl font-bold text-gray-900 mt-3 mb-5">
            Your private ad network
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto mb-12">
            Aggregate demand from Adsterra, Google AdX, PubMatic and more. Distribute to all your publishers automatically. Track revenue in real time.
          </p>
          <div className="grid md:grid-cols-4 gap-5 max-w-4xl mx-auto">
            {[
              { icon: '📢', title: 'Create Ad Units', desc: 'GAM or direct ad codes. Header, in-content, footer, sidebar positions.' },
              { icon: '🎯', title: 'Assign to Publishers', desc: 'Custom revenue split % per publisher per site.' },
              { icon: '🔌', title: 'Auto-inject', desc: 'Ads appear in all articles via WordPress plugin automatically.' },
              { icon: '📊', title: 'Track Revenue', desc: 'Live Adsterra dashboard with impressions, CPM, CTR and earnings.' },
            ].map(s => (
              <div key={s.title} className="bg-white rounded-2xl p-5 border border-gray-100 text-left">
                <div className="text-2xl mb-3">{s.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1 text-sm">{s.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Languages */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">10 Indian Languages</h2>
          <p className="text-gray-500 mb-8">Generate full articles in any Indian language — AI writes natively, not translated</p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              ['English', 'EN'], ['हिन्दी', 'HI'], ['தமிழ்', 'TA'], ['తెలుగు', 'TE'],
              ['ಕನ್ನಡ', 'KN'], ['മലയാളം', 'ML'], ['मराठी', 'MR'], ['ગુજરાતી', 'GU'],
              ['বাংলা', 'BN'], ['ਪੰਜਾਬੀ', 'PA'],
            ].map(([name]) => (
              <span key={name} className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm text-gray-700 font-medium">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-900 py-20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to build your publisher network?
          </h2>
          <p className="text-gray-400 mb-8">
            Start free. Onboard publishers. Inject ads. Track revenue. All from one dashboard.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/signup"
              className="bg-red-500 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-red-600 transition-colors text-sm">
              Get started free →
            </Link>
            <Link href="/pricing"
              className="bg-white/10 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-white/20 transition-colors text-sm">
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between flex-wrap gap-4">
          <span className="font-bold text-gray-900">Trending<span className="text-red-500">Verse</span></span>
          <div className="flex items-center gap-6 text-xs text-gray-400">
            <Link href="/pricing" className="hover:text-gray-600">Pricing</Link>
            <Link href="/login" className="hover:text-gray-600">Sign in</Link>
            <Link href="/signup" className="hover:text-gray-600">Sign up</Link>
            <a href="mailto:support@trendingverse.online" className="hover:text-gray-600">Support</a>
          </div>
          <p className="text-xs text-gray-400">© 2026 TrendingVerse · Made in India 🇮🇳</p>
        </div>
      </footer>

    </div>
  )
}
