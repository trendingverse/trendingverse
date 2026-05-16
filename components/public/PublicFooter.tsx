export function PublicFooter() {
  return (
    <footer className="bg-ink-950 text-ink-400 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="font-bold text-xl text-white mb-3">TrendingVerse</div>
            <p className="text-sm leading-relaxed">Breaking news and trending stories from around the world.</p>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-3 uppercase tracking-wide">Categories</h4>
            <ul className="space-y-2 text-sm">
              {['Technology','Business','Politics','Sports','Entertainment','World'].map(c => <li key={c}><a href={`/${c.toLowerCase()}`} className="hover:text-white transition-colors">{c}</a></li>)}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-3 uppercase tracking-wide">Company</h4>
            <ul className="space-y-2 text-sm">
              {['About Us','Contact','Privacy Policy','Terms of Service','Advertise with Us'].map(p => <li key={p}><a href="#" className="hover:text-white transition-colors">{p}</a></li>)}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-3 uppercase tracking-wide">Newsletter</h4>
            <p className="text-sm mb-3">Get the latest stories in your inbox.</p>
            <NewsletterSignup />
          </div>
        </div>
        <div className="border-t border-ink-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <p>© {new Date().getFullYear()} TrendingVerse. All rights reserved.</p>
          <p className="text-xs text-ink-600">Some content may be sponsored or contain affiliate links.</p>
        </div>
      </div>
    </footer>
  )
}
function NewsletterSignup() {
  return (
    <form action="/api/newsletter" method="POST" className="flex gap-2">
      <input type="email" name="email" placeholder="your@email.com" required className="flex-1 px-3 py-2 bg-ink-900 border border-ink-700 rounded-lg text-sm text-white placeholder:text-ink-600 focus:outline-none focus:border-accent" />
      <button type="submit" className="bg-accent text-white px-3 py-2 rounded-lg text-sm hover:bg-accent-hover transition-colors">→</button>
    </form>
  )
}
