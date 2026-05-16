import { createClient } from '@/lib/supabase/server'
export async function PublicHeader() {
  const supabase = await createClient()
  const { data: cats } = await supabase.from('categories').select('name,slug').order('article_count',{ascending:false}).limit(7)
  return (
    <header className="border-b border-ink-100 bg-white sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        <a href="/" className="font-bold text-xl text-ink-950 tracking-tight">Trending<span className="text-accent">Verse</span></a>
        <nav className="hidden md:flex items-center gap-1">
          {(cats||[]).map(c => <a key={c.slug} href={`/${c.slug}`} className="px-3 py-1.5 text-sm text-ink-600 hover:text-accent hover:bg-red-50 rounded-lg transition-colors">{c.name}</a>)}
        </nav>
        <div className="flex items-center gap-3">
          <a href="/admin" className="text-xs text-ink-400 hover:text-accent hidden sm:inline">Admin ↗</a>
        </div>
      </div>
    </header>
  )
}
