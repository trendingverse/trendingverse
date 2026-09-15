// app/(admin)/admin/page.tsx
// Logic identical to original — only visual layout improved
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Same queries as original
  const [{ count: total }, { count: published }] = await Promise.all([
    supabase.from('articles').select('*', { count: 'exact', head: true }),
    supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'published'),
  ])

  const drafts    = (total ?? 0) - (published ?? 0)
  const firstName = user.email?.split('@')[0] ?? 'there'

  return (
    <div className="space-y-8 max-w-4xl">

      {/* Welcome */}
      <div>
        <p className="text-xs font-semibold text-ink-300 uppercase tracking-[0.12em] mb-1">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <h1 className="font-display text-2xl font-bold text-ink-950">
          Welcome back, {firstName} 👋
        </h1>
        <p className="text-sm text-ink-400 mt-1">Here&apos;s what&apos;s going on with your CMS today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card p-5 space-y-1">
          <p className="text-xs font-medium text-ink-400 uppercase tracking-wide">Total Articles</p>
          <p className="text-3xl font-display font-bold text-accent">{total ?? 0}</p>
          <p className="text-xs text-ink-300">Across all publishers</p>
        </div>
        <div className="card p-5 space-y-1">
          <p className="text-xs font-medium text-ink-400 uppercase tracking-wide">Published</p>
          <p className="text-3xl font-display font-bold text-emerald-600">{published ?? 0}</p>
          <p className="text-xs text-ink-300">Live on sites</p>
        </div>
        <div className="card p-5 space-y-1">
          <p className="text-xs font-medium text-ink-400 uppercase tracking-wide">Drafts</p>
          <p className="text-3xl font-display font-bold text-amber-500">{drafts}</p>
          <p className="text-xs text-ink-300">Pending review</p>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-xs font-semibold text-ink-400 uppercase tracking-[0.12em] mb-3">Quick Actions</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { href: '/admin/articles/new', label: 'New Article',    icon: '✏️',  color: 'bg-accent text-white hover:bg-accent/90' },
            { href: '/admin/ai-writer',    label: 'AI Writer',      icon: '✦',   color: 'bg-violet-50 text-violet-700 hover:bg-violet-100' },
            { href: '/admin/trends',       label: 'Trending Topics', icon: '🔥',  color: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
            { href: '/admin/articles',     label: 'All Articles',   icon: '▤',   color: 'bg-ink-50 text-ink-700 hover:bg-ink-100' },
            { href: '/admin/seo',          label: 'SEO Engine',     icon: '◈',   color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
            { href: '/admin/media',        label: 'Media Library',  icon: '◧',   color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
          ].map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`${item.color} rounded-xl px-4 py-3.5 font-semibold text-sm transition-all flex items-center gap-2.5`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
