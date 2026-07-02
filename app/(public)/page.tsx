import Link from 'next/link'
import { createClient as createServiceClient } from '@supabase/supabase-js'

async function getRecentArticles() {
  try {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data } = await supabase
      .from('articles')
      .select('id, title, excerpt, category_name, published_at, slug')
      .eq('status', 'published')
      .not('slug', 'is', null)
      .not('slug', 'eq', '')
      .order('published_at', { ascending: false })
      .limit(6)
    // Construct the live WordPress URL from slug
    return (data || []).map((a: any) => ({
      ...a,
      wp_url: `https://trendingverse.online/${a.slug}/`,
    }))
  } catch {
    return []
  }
}

export default async function LandingPage() {
  const recentArticles = await getRecentArticles()
  const pulseItems = [
    { type: 'PUBLISH', typeCls: 'bg-blue-500/20 text-blue-300', text: 'Article auto-published: "GRSE Conferred Navratna Status" — trendingverse.online', time: 'just now' },
    { type: 'AD', typeCls: 'bg-amber-500/20 text-amber-300', text: 'Brand campaign served 2,982 impressions · geo-targeted · Mumbai, Delhi, Bangalore', time: '2m ago' },
    { type: 'RATES', typeCls: 'bg-green-500/20 text-green-300', text: 'AED → INR updated · 1 AED = 22.84 INR · Finance / Currency Rates', time: '4m ago' },
    { type: 'AUDIENCE', typeCls: 'bg-violet-500/20 text-violet-300', text: '17,884 audience profiles tracked · scroll depth · city-level geo · email leads', time: '6m ago' },
    { type: 'SEO', typeCls: 'bg-rose-500/20 text-rose-300', text: 'SEO rewrite complete · 21 articles re-categorized · Discover scores updated', time: '9m ago' },
  ]

  const moatCards = [
    { icon: '🎯', title: 'Direct Ad Marketplace', desc: 'Sell ads directly to local and national advertisers — geo-targeted, frequency-capped, fully tracked. No agency split, no AdSense floor.', tag: 'Exclusive', tagCls: 'bg-amber-500/10 text-amber-600' },
    { icon: '📊', title: 'Real Audience Intelligence', desc: 'Scroll depth per article, city-level breakdown, device split, and actual email leads via Google One Tap. Not just pageviews.', tag: 'Audience Layer', tagCls: 'bg-blue-500/10 text-blue-600' },
    { icon: '💱', title: 'Daily Financial Data Pages', desc: 'Auto-updated currency rate pages (AED, SAR, USD, GBP, QAR → INR) published every morning with AI context — built to rank like GoodReturns.', tag: 'SEO Moat', tagCls: 'bg-green-500/10 text-green-700' },
    { icon: '🎬', title: 'Article → Video Pipeline', desc: 'Turn any article into a YouTube (16:9) or Instagram Reels (9:16) video. AI generates the script, images, voiceover, captions, and upload metadata.', tag: 'Video Studio', tagCls: 'bg-violet-500/10 text-violet-600' },
    { icon: '🔗', title: 'URL Rewrite in Any Language', desc: 'Paste any article URL from any site in any language. We fetch it, detect the source language, and rewrite a completely original version in your language.', tag: 'AI Writer', tagCls: 'bg-blue-500/10 text-blue-600' },
    { icon: '📋', title: 'Publisher Outreach CRM', desc: 'Find advertisers for your network — brief-based matching, website contact scanning, AI email drafting, and CSV export. A full B2B sales pipeline inside your CMS.', tag: 'Ad Network', tagCls: 'bg-amber-500/10 text-amber-600' },
  ]

  const publisherFeatures = [
    { icon: '✦', title: 'AI Writer — 10+ Languages', desc: 'Generate full SEO-optimized articles in Kannada, Hindi, Tamil, Telugu and 7 more Indian languages. Gemini, GPT-4o or Claude — your choice.' },
    { icon: '🔗', title: 'Paste URL → Rewrite', desc: 'Paste any article URL from any website. AI detects the source language and rewrites a completely original, plagiarism-free version in your language.' },
    { icon: '🚀', title: 'WordPress Auto-Sync', desc: 'Every article published in TrendingVerse appears on your live WordPress site — AI image, correct category, Yoast SEO fields. Zero copy-pasting.' },
    { icon: '⏰', title: 'Daily Auto-Publish Cron', desc: 'Your site gets fresh trending content every morning. Article written, image generated, category assigned, published — no human needed.' },
    { icon: '🎬', title: 'Article to Video', desc: 'One click turns any article into a YouTube or Instagram Reels video — AI script, images, voiceover, captions, and upload-ready metadata.' },
    { icon: '🔍', title: 'SEO & Discover Engine', desc: 'Every article gets a Google Discover readiness score, subheading injection, focus keyword, and meta description — before it goes live.' },
  ]

  const advertiserFeatures = [
    { icon: '🎯', title: 'AI Publisher Matching', desc: 'Paste your campaign brief. AI suggests the best publishers across India and globally with fit scores, audience data, and contact details.' },
    { icon: '✉', title: 'Professional Email Drafts', desc: 'Click any publisher — AI drafts a complete outreach email personalized to their audience and your campaign details.' },
    { icon: '📊', title: 'Campaign Management', desc: 'Create campaigns, set geo targets (country → state → city), frequency caps, and track impressions and clicks in real time.' },
    { icon: '🏢', title: 'Publisher Database', desc: 'Save publishers with contact tracking — prospect, contacted, responded, onboarded. Never lose track of a deal.' },
    { icon: '📈', title: 'Campaign Reports', desc: 'Full breakdown by site, geo, day — with CSV export and email delivery to your advertiser clients.' },
    { icon: '⬇', title: 'CSV Export', desc: 'Export your publisher list with audience size, contact details, fit scores, and outreach status to share with your team.' },
  ]

  return (
    <div className="min-h-screen bg-white">

      {/* ── NAV ─────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0B1120]/95 backdrop-blur border-b border-white/[0.06] px-6 py-0 flex items-center justify-between h-16">
        <div className="font-bold text-xl text-white tracking-tight">
          Trending<span className="text-amber-400">Verse</span>
        </div>
        <div className="hidden md:flex items-center gap-6">
          <a href="#platform" className="text-sm text-white/50 hover:text-white transition-colors">Platform</a>
          <a href="#advertisers" className="text-sm text-white/50 hover:text-white transition-colors">Advertisers</a>
          <a href="#pricing" className="text-sm text-white/50 hover:text-white transition-colors">Pricing</a>
          <Link href="/login" className="text-sm text-white/50 hover:text-white transition-colors">Sign in</Link>
          <Link href="/signup" className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold">
            Get started free
          </Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────── */}
      <section className="bg-[#0B1120] min-h-screen flex flex-col justify-center items-center text-center px-6 pt-24 pb-16 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-600/10 rounded-full blur-[100px]" />
        </div>
        {/* Bottom line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-40" />

        <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-medium px-3 py-1.5 rounded-full mb-8 tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          India's only CMS with a built-in direct ad marketplace
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white leading-[1.02] tracking-tight mb-6 max-w-4xl">
          Publish smarter.<br />
          <span className="text-amber-400">Monetize directly.</span>
        </h1>

        <p className="text-lg text-white/50 max-w-xl mb-10 leading-relaxed">
          TrendingVerse gives Indian news publishers the tools to write, publish, sell ads directly, and understand their audience — in one platform, in 10+ languages.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap mb-14">
          <Link href="/signup" className="px-7 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors">
            Start free — no credit card
          </Link>
          <a href="#platform" className="px-7 py-3 border border-white/15 text-white/80 font-medium rounded-xl hover:border-white/30 transition-colors">
            See the platform →
          </a>
        </div>

        {/* Platform Pulse */}
        <div className="w-full max-w-2xl bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 text-green-400 text-xs font-medium">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Platform live
            </div>
            <span className="text-white/20 text-xs font-mono">TrendingVerse — Activity</span>
          </div>
          <div>
            {pulseItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.03] last:border-b-0">
                <span className={`shrink-0 text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${item.typeCls}`}>
                  {item.type}
                </span>
                <span className="text-white/45 text-xs flex-1 text-left truncate">{item.text}</span>
                <span className="text-white/20 text-[10px] font-mono shrink-0">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS BAR ───────────────────────────────────── */}
      <div className="bg-[#141E33] border-b border-white/[0.06] px-6 py-8 flex flex-wrap gap-6 justify-center items-center">
        {[
          { value: '10+', label: 'Indian Languages' },
          { value: '200+', label: 'Articles Published' },
          { value: '17K+', label: 'Audience Profiles' },
          { value: '₹0', label: 'To Start' },
        ].map((s, i) => (
          <div key={i} className="text-center px-8 border-r border-white/[0.06] last:border-r-0">
            <div className="text-3xl font-bold text-white tracking-tight">{s.value}</div>
            <div className="text-xs text-white/30 uppercase tracking-widest mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── THREE LAYERS ────────────────────────────────── */}
      <section id="platform" className="max-w-6xl mx-auto px-6 py-24">
        <div className="mb-4 text-xs font-mono font-medium tracking-widest uppercase text-blue-600">The platform</div>
        <h2 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">One platform.<br />Three revenue layers.</h2>
        <p className="text-gray-500 max-w-lg mb-14 leading-relaxed">Not just a CMS. A publishing stack with a built-in ad marketplace and audience intelligence from day one.</p>

        <div className="grid md:grid-cols-3 gap-0 border border-gray-200 rounded-2xl overflow-hidden">
          {[
            {
              badge: 'Publish', badgeCls: 'bg-blue-50 text-blue-600',
              borderCls: 'border-t-4 border-t-blue-500',
              title: 'Write & Publish',
              desc: 'AI writer, auto-publish cron, URL rewrite, SEO scoring, WordPress sync, AI images, article-to-video.',
              features: ['AI Writer in 10+ Indian languages', 'Paste any URL → rewrite in your language', 'Daily auto-publish cron (trending news)', 'SEO engine with Discover scoring', 'WordPress sync with auto-category creation', 'AI-generated images per article', 'Article → YouTube + Instagram video'],
            },
            {
              badge: 'Monetize', badgeCls: 'bg-amber-50 text-amber-700',
              borderCls: 'border-t-4 border-t-amber-400',
              title: 'Direct Ad Marketplace',
              desc: 'Sell ads directly to advertisers — geo-targeted, frequency-capped, fully tracked. No intermediary, no AdSense floor.',
              features: ['Advertiser self-serve onboarding portal', 'Geo targeting (Country → State → City)', 'Impression + click tracking per campaign', 'Campaign reports with CSV export', 'Frequency capping per user per day', 'Publisher Outreach CRM to find advertisers', 'Email campaign reports to advertisers'],
            },
            {
              badge: 'Grow', badgeCls: 'bg-green-50 text-green-700',
              borderCls: 'border-t-4 border-t-green-500',
              title: 'Audience & Data',
              desc: 'Know your readers. Daily financial data pages that rank on Google and build long-term organic traffic.',
              features: ['Audience profiles + scroll depth funnel', 'Google One Tap email capture', 'City-level geo + device breakdown', 'Currency rate pages (AED/SAR/USD/GBP/QAR → INR)', 'Daily auto-updated data verticals', 'Finance → Currency Rates SEO cluster', 'Audience dashboard with date filters'],
            },
          ].map((layer, i) => (
            <div key={i} className={`p-8 ${layer.borderCls} ${i < 2 ? 'border-r border-gray-200' : ''}`}>
              <span className={`inline-block text-xs font-mono font-semibold tracking-wider uppercase px-2 py-1 rounded mb-4 ${layer.badgeCls}`}>
                {layer.badge}
              </span>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{layer.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-5">{layer.desc}</p>
              <ul className="space-y-2">
                {layer.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-gray-600 py-1.5 border-b border-gray-100 last:border-0">
                    <span className="text-gray-400 shrink-0 mt-0.5">→</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── MOAT ────────────────────────────────────────── */}
      <section className="bg-[#0B1120] py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-4 text-xs font-mono font-medium tracking-widest uppercase text-amber-400">Why TrendingVerse</div>
          <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">Features no other Indian<br />publisher CMS has.</h2>
          <p className="text-white/40 max-w-lg mb-14 leading-relaxed">These aren't on the roadmap. They're live, running, and powering publishers today.</p>
          <div className="grid md:grid-cols-3 gap-4">
            {moatCards.map((card, i) => (
              <div key={i} className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-6 hover:border-blue-500/40 hover:bg-blue-500/[0.04] transition-all">
                <div className="text-2xl mb-4">{card.icon}</div>
                <h3 className="text-base font-semibold text-white mb-2">{card.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed mb-4">{card.desc}</p>
                <span className={`inline-block text-[11px] font-mono font-medium px-2 py-0.5 rounded ${card.tagCls}`}>{card.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PUBLISHER FEATURES ──────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">For Publishers</div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything your newsroom needs</h2>
          <p className="text-gray-500">From article generation to revenue — one platform</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {publisherFeatures.map((f, i) => (
            <div key={i} className="p-6 border border-gray-100 rounded-2xl hover:shadow-md hover:border-gray-200 transition-all">
              <div className="text-2xl mb-4">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── ADVERTISER FEATURES ─────────────────────────── */}
      <section id="advertisers" className="bg-gradient-to-br from-violet-50 to-blue-50 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-violet-100 text-violet-700 text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">For Advertisers</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Find publishers. Close deals faster.</h2>
            <p className="text-gray-500">AI-powered outreach that saves weeks of manual research</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {advertiserFeatures.map((f, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-violet-100 hover:shadow-md transition-shadow">
                <div className="text-2xl mb-4">{f.icon}</div>
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
            <p className="text-sm text-gray-400 mt-3">Invite-only access · Accounts created by admin</p>
          </div>
        </div>
      </section>

      {/* ── LANGUAGES ───────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-100 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-3">Built for Indian publishers 🇮🇳</h3>
          <p className="text-gray-500 mb-6">Write AI articles in 10 regional languages — not translated from English, written in it</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {['English','हिंदी','தமிழ்','తెలుగు','ಕನ್ನಡ','മലയാളം','मराठी','ગુજરાતી','বাংলা','ਪੰਜਾਬੀ'].map(lang => (
              <span key={lang} className="px-3 py-1.5 bg-white border border-orange-100 rounded-full text-sm font-medium text-gray-700">
                {lang}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE FROM THE CMS ────────────────────────── */}
      {recentArticles.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex items-center justify-between mb-10">
            <div>
              <div className="text-xs font-mono font-medium tracking-widest uppercase text-blue-600 mb-2">Live from the platform</div>
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Articles published by TrendingVerse</h2>
              <p className="text-gray-500 mt-2 text-sm">Real articles, auto-published by the AI cron — live on trendingverse.online</p>
            </div>
            <a href="https://trendingverse.online" target="_blank" rel="noreferrer"
              className="hidden md:inline-flex items-center gap-2 text-sm text-blue-600 font-medium hover:underline shrink-0">
              View all articles ↗
            </a>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {recentArticles.map((article: any) => (
              <a
                key={article.id}
                href={article.wp_url || 'https://trendingverse.online'}
                target="_blank" rel="noreferrer"
                className="group block border border-gray-100 rounded-2xl p-5 hover:border-blue-200 hover:shadow-md transition-all"
              >
                {article.category_name && (
                  <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded mb-3">
                    {article.category_name}
                  </span>
                )}
                <h3 className="font-semibold text-gray-900 leading-snug mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                  {article.title}
                </h3>
                {article.excerpt && (
                  <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-3">
                    {article.excerpt.replace(/<[^>]+>/g, '')}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {article.published_at
                      ? new Date(article.published_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                      : ''}
                  </span>
                  <span className="text-xs text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">Read →</span>
                </div>
              </a>
            ))}
          </div>
          <div className="text-center mt-8 md:hidden">
            <a href="https://trendingverse.online" target="_blank" rel="noreferrer"
              className="text-sm text-blue-600 font-medium hover:underline">
              View all articles on trendingverse.online ↗
            </a>
          </div>
        </section>
      )}

      {/* ── PRICING ─────────────────────────────────────── */}
      <section id="pricing" className="bg-gray-50 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">Publisher Plans</div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-3">Publisher-first pricing</h2>
          <p className="text-gray-500 text-center mb-2">Every rupee you spend comes back multiplied</p>
          <p className="text-center text-sm text-green-600 font-medium mb-12">
            Publishers earning ₹3,000/mo from direct ads pay just ₹399 — a 7× return
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
                {['Unlimited AI articles','Unlimited WP sites','Platform AI keys included','Direct Ad Marketplace','Audience intelligence','Article → Video pipeline','Currency rate data pages','Publisher Outreach CRM','Priority support'].map(f => (
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
                {['Everything in Pro','Unlimited publishers','Platform AI keys','White-label ready','Advanced analytics','Dedicated support','Early access to new features'].map(f => (
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
              <span>Growth ₹399 · earn ₹2,000/mo from direct ads → <strong>5× ROI</strong></span>
              <span>Pro ₹799 · earn ₹5,000/mo → <strong>6× ROI</strong></span>
              <span>Agency ₹1,999 · earn ₹20,000/mo → <strong>10× ROI</strong></span>
            </div>
          </div>
          <div className="mt-6 text-center text-sm text-gray-400">
            100% secure payments · Indian payment methods · Cancel anytime ·{' '}
            <Link href="/pricing" className="text-red-500 hover:underline">Full feature comparison →</Link>
          </div>
        </div>
      </section>

      {/* ── DUAL CTA ────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="text-center p-8 border border-gray-100 rounded-2xl">
            <p className="text-2xl mb-3">📰</p>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Are you a Publisher?</h3>
            <p className="text-gray-500 text-sm mb-6">Start generating AI content and earning from direct ads today</p>
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

      {/* ── FOOTER ──────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} TrendingVerse · Made in India 🇮🇳 ·{' '}
        <Link href="/pricing" className="hover:text-gray-600">Pricing</Link> ·{' '}
        <Link href="/login" className="hover:text-gray-600">Sign in</Link> ·{' '}
        <a href="mailto:yusuf@trendingverse.online" className="hover:text-gray-600">Support</a>
      </footer>

      {/* WhatsApp float */}
      <a href="https://wa.me/919000000000" target="_blank" rel="noreferrer"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#25D366] flex items-center justify-center text-2xl shadow-lg shadow-green-500/30 hover:scale-110 transition-transform"
        title="Chat on WhatsApp">
        💬
      </a>
    </div>
  )
}
