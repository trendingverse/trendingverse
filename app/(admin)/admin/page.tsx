import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ count: total }, { count: published }] = await Promise.all([
    supabase.from('articles').select('*', { count: 'exact', head: true }),
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'published'),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">Dashboard</h1>
        <p className="text-sm text-ink-400 mt-1">Welcome to TrendingVerse CMS</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-xs text-ink-400">Total Articles</p>
          <p className="text-3xl font-display font-bold text-accent">{total || 0}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-ink-400">Published</p>
          <p className="text-3xl font-display font-bold text-emerald-600">{published || 0}</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { href: '/admin/articles/new', label: '+ New Article', color: 'bg-accent text-white' },
          { href: '/admin/ai-writer', label: '✦ AI Writer', color: 'bg-violet-50 text-violet-700' },
          { href: '/admin/articles', label: '▤ All Articles', color: 'bg-ink-50 text-ink-700' },
          { href: '/admin/seo', label: '◈ SEO Engine', color: 'bg-blue-50 text-blue-700' },
          { href: '/admin/media', label: '◧ Media Library', color: 'bg-amber-50 text-amber-700' },
          { href: '/admin/settings', label: '⚙ Settings', color: 'bg-ink-50 text-ink-700' },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className={`${item.color} rounded-xl p-5 font-semibold text-sm hover:opacity-90 transition-opacity`}>
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
