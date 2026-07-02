import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="font-bold text-xl">Trending<span className="text-red-500">Verse</span></div>
        <div className="flex items-center gap-6">
          <a href="#publishers" className="text-sm text-gray-600 hover:text-gray-900">Publishers</a>
          <a href="#advertisers" className="text-sm text-gray-600 hover:text-gray-900">Advertisers</a>
          <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900">Pricing</a>
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">Sign in</Link>
          <Link href="/signup" className="text-sm px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Get started free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 text-xs font-medium px-3 py-1 rounded-full mb-6">
          🔥 India's AI-Powered Publishing & Ad Network Platform
        </div>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
          One platform for<br />
          <span className="text-red-500">Publishers & Advertisers</span>
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          Publishers create AI content and monetize automatically. Advertisers find the right publishers, draft outreach emails and track campaigns — all in one place.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/signup" className="px-8 py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-colors text-lg">
            Start free — no credit card
          </Link>
          <Link href="/login" className="px-8 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-lg">
            Sign in →
          </Link>
        </div>
        <p className="text-sm text-gray-400 mt-4">Free plan includes 5 articles/day · Advertiser access by invite</p>
      </section>

      {/* Two audiences */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Publishers */}
          <div id="publishers" className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-100 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-white text-lg">📰</div>
              <div>
                <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">For Publishers</p>
                <p className="font-bold text-gray-900 text-lg">CMS + Ad Network</p>
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
              Generate AI articles in 10 Indian languages, auto-publish to WordPress, inject programmatic ads and track revenue — all from one dashboard.
            </p>
            <ul className="space-y-2 mb-6">
              {[
                '✦ AI article generator in 10 languages',
                '🚀 WordPress auto-publish + Pexels photos',
                '💰 Programmatic ad injection (header, in-content, footer)',
                '📊 Revenue dashboard + GSC + GA4',
                '🔌 WordPress ads plugin — auto-updates',
                '⏰ Daily auto-publish cron at 9 AM IST',
              ].map(f => (
                <li key={f} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="shrink-0">{f.split(' ')[0]}</span>
                  <span>{f.split(' ').slice(1).join(' ')}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <Link href="/signup" className="flex-1 text-center py-2.5 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition-colors">
                Start free →
              </Link>
              <Link href="/admin" className="flex-1 text-center py-2.5 border border-red-200 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 transition-colors">
                View demo
              </Link>
            </div>
          </div>

          {/* Advertisers */}
          <div id="advertisers" className="bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-100 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center text-white text-lg">📋</div>
              <div>
                <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">For Advertisers</p>
                <p className="font-bold text-gray-900 text-lg">Publisher Outreach CRM</p>
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
              Paste your campaign brief — AI instantly matches you with the right publishers, drafts professional outreach emails and tracks your entire campaign pipeline.
            </p>
            <ul className="space-y-2 mb-6">
              {[
                '✦ AI-powered publisher matching from campaign brief',
                '🌏 India + Global publisher suggestions',
                '✉ AI-drafted professional outreach emails',
                '📧 One-click Gmail compose with pre-filled email',
                '🏢 Publisher database with contact tracking',
                '⬇ Export publisher list as CSV',
              ].map(f => (
                <li key={f} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="shrink-0">{f.split(' ')[0]}</span>
                  <span>{f.split(' ').slice(1).join(' ')}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <a href="mailto:yusuf@trendingverse.online?subject=Advertiser Access Request"
                className="flex-1 text-center py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors">
                Request access →
              </a>
              <Link href="/login" className="flex-1 text-center py-2.5 border border-violet-200 text-violet-600 text-sm font-semibold rounded-xl hover:bg-violet-50 transition-colors">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-100 py-12">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
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

      {/* Publisher Features */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">For Publishers</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything a publisher needs</h2>
          <p className="text-gray-500">From article generation to revenue — one platform</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: '✦', title: 'AI Article Generator', desc: 'Generate full SEO-optimized articles in Kannada, Hindi, Tamil, Telugu and 6 more languages using Gemini, GPT-4o or Claude.' },
            { icon: '📋', title: 'Paste & Enrich', desc: 'Paste any WhatsApp article — AI generates SEO title, meta, keywords, Google Discover headline and readability score in the same language.' },
            { icon: '🚀', title: 'WordPress Auto-Publish', desc: 'Push articles with auto-fetched Pexels photos, Yoast SEO meta and duplicate protection in one click.' },
            { icon: '💰', title: 'Programmatic Ad Network', desc: 'Create ad units, assign to publishers with custom revenue splits. Ads auto-inject into all articles — header, in-content, footer.' },
            { icon: '🔍', title: 'Google Search Console', desc: 'Connect GSC per publisher — clicks, impressions, keyword rankings and Discover traffic in one dashboard.' },
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

      {/* Advertiser Features */}
      <section className="bg-gradient-to-br from-violet-50 to-blue-50 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-violet-100 text-violet-700 text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">For Advertisers</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Find publishers. Close deals faster.</h2>
            <p className="text-gray-500">AI-powered outreach that saves weeks of manual research</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: '🎯',
                title: 'AI Publisher Matching',
                desc: 'Paste your campaign brief — brand, target audience, region, budget. AI instantly suggests the best publishers across India and globally with fit scores.',
              },
              {
                icon: '✉',
                title: 'Professional Email Drafts',
                desc: 'Click any publisher — AI drafts a complete 200-word professional outreach email personalized to that publisher\'s audience and your campaign details.',
              },
              {
                icon: '📧',
                title: 'One-Click Gmail Send',
                desc: 'Hit Send — Gmail opens with the email pre-filled to the publisher\'s contact. Review and send from your official email in seconds.',
              },
              {
                icon: '🏢',
                title: 'Publisher Database',
                desc: 'Save publishers to your database. Track outreach status — prospect, contacted, responded, onboarded. Never lose track of a deal.',
              },
              {
                icon: '📊',
                title: 'Campaign Management',
                desc: 'Create multiple campaigns for different brands or products. Edit briefs, update status and track publisher outreach per campaign.',
              },
              {
                icon: '⬇',
                title: 'CSV Export',
                desc: 'Export your full publisher list with contact details, audience size, fit scores and outreach status to share with your team.',
              },
            ].map(f => (
              <div key={f.title} className="bg-white p-6 rounded-2xl border border-violet-100 hover:shadow-md transition-shadow">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <a href="mailto:yusuf@trendingverse.online?subject=Advertiser Access Request"
              className="inline-flex px-8 py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors">
              Request Advertiser Access →
            </a>
            <p className="text-sm text-gray-400 mt-3">Accounts created by admin · Invite-only access</p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-gray-50 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">Publisher Plans</div>
          </div>
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
                {['5 AI articles/day','1 WordPress site','Own AI API key','SEO Engine','Paste & Enrich','Basic analytics'].map(f => (
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
                {['50 AI articles/day','3 WordPress sites','Own AI API key','Auto-publish cron','Google Search Console','Google Analytics 4','Basic ad injection'].map(f => (
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
                {['Unlimited AI articles','Unlimited WP sites','Platform AI keys included','GPT-4o + Claude + Gemini','Full ad network','Revenue dashboard','WP Ads plugin','Publisher management','Priority support'].map(f => (
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
                {['Everything in Pro','Unlimited publishers','Platform AI keys','White-label ready','Advanced analytics','Dedicated support','Early access'].map(f => (
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

      {/* Dual CTA */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="text-center p-8 border border-gray-100 rounded-2xl">
            <p className="text-2xl mb-3">📰</p>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Are you a Publisher?</h3>
            <p className="text-gray-500 text-sm mb-6">Start generating AI content and monetizing with programmatic ads today</p>
            <Link href="/signup" className="inline-flex px-6 py-2.5 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-colors">
              Start free →
            </Link>
          </div>
          <div className="text-center p-8 bg-violet-50 border border-violet-100 rounded-2xl">
            <p className="text-2xl mb-3">🏢</p>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Are you an Advertiser?</h3>
            <p className="text-gray-500 text-sm mb-6">Get invite-only access to our publisher outreach CRM and campaign tools</p>
            <a href="mailto:yusuf@trendingverse.online?subject=Advertiser Access Request"
              className="inline-flex px-6 py-2.5 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors">
              Request access →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} TrendingVerse · Made in India 🇮🇳 ·{' '}
        <Link href="/pricing" className="hover:text-gray-600">Pricing</Link> ·{' '}
        <Link href="/login" className="hover:text-gray-600">Sign in</Link> ·{' '}
        <a href="mailto:Yusuf@trendingverse.online" className="hover:text-gray-600">Support</a>
      </footer>
    </div>
  )
}
