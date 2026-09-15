// app/(admin)/admin/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function safe<T>(fn: () => any, fallback: T): Promise<T> {
  try { const r = await fn(); return (r?.error ? fallback : r?.data ?? r?.count ?? fallback) } catch { return fallback }
}
async function count(fn: () => any): Promise<number> {
  try { const r = await fn(); return r?.error ? 0 : (r?.count ?? 0) } catch { return 0 }
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="card p-5 space-y-1">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400 dark:text-slate-600">{label}</p>
      <p className={`text-3xl font-display font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-ink-400 dark:text-slate-600">{sub}</p>}
    </div>
  )
}

function QuickAction({ href, icon, label, desc, accent = false }: { href: string; icon: string; label: string; desc: string; accent?: boolean }) {
  return (
    <Link href={href}
      className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all duration-150 ${
        accent
          ? 'bg-accent text-white border-accent hover:bg-accent-hover hover:border-accent-hover shadow-sm'
          : 'bg-white dark:bg-dark-100 border-ink-100 dark:border-dark-border hover:border-ink-200 dark:hover:border-dark-50 hover:shadow-sm'
      }`}>
      <span className="text-xl flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className={`text-sm font-semibold truncate ${accent ? 'text-white' : 'text-ink-900 dark:text-slate-100'}`}>{label}</p>
        <p className={`text-xs truncate ${accent ? 'text-white/70' : 'text-ink-400 dark:text-slate-600'}`}>{desc}</p>
      </div>
      <span className={`ml-auto flex-shrink-0 ${accent ? 'text-white/60 group-hover:text-white' : 'text-ink-300 dark:text-slate-700 group-hover:text-ink-500 dark:group-hover:text-slate-400'} transition-colors`}>→</span>
    </Link>
  )
}

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const todayISO = now.toISOString().slice(0, 10)

  const [total, published, drafts, todayPub, recentArticles] = await Promise.all([
    count(() => supabase.from('articles').select('*', { count: 'exact', head: true })),
    count(() => supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'published')),
    count(() => supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'draft')),
    count(() => supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'published').gte('published_at', todayISO + 'T00:00:00Z')),
    safe(() => supabase.from('articles').select('id,title,status,published_at,category_name').order('created_at', { ascending: false }).limit(8), []),
  ])

  const firstName = user.email?.split('@')[0] ?? 'there'
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' })

  return (
    <div className="space-y-8 pb-8">

      {/* Welcome */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-300 dark:text-slate-700 mb-1">
            {dayName}, {now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <h1 className="font-display text-2xl font-bold text-ink-950 dark:text-white">
            Good {now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening'}, {firstName}
          </h1>
          <p className="text-sm text-ink-400 dark:text-slate-600 mt-1">Here&apos;s your CMS overview for today.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/trends" className="btn btn-secondary btn-sm">
            🔥 Trends
          </Link>
          <Link href="/admin/articles/new" className="btn btn-primary btn-sm">
            + New Article
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total articles"    value={String(total)}     sub="All time"                color="text-ink-950 dark:text-white" />
        <StatCard label="Published"         value={String(published)} sub={`${todayPub} today`}     color="text-emerald-600 dark:text-emerald-400" />
        <StatCard label="Drafts"            value={String(drafts)}    sub="Pending review"          color="text-amber-500 dark:text-amber-400" />
        <StatCard label="Published today"   value={String(todayPub)}  sub={todayISO}                color="text-accent dark:text-red-400" />
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-5 gap-6">

        {/* Recent articles */}
        <div className="lg:col-span-3 card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-50 dark:border-dark-border">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400 dark:text-slate-600">Recent Articles</p>
            <Link href="/admin/articles" className="text-xs font-medium text-accent hover:text-accent-hover transition-colors">All articles →</Link>
          </div>
          {(recentArticles as any[]).length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-ink-400 dark:text-slate-600 text-sm">No articles yet.</p>
              <Link href="/admin/articles/new" className="text-accent text-sm mt-1 inline-block">Create your first →</Link>
            </div>
          ) : (
            <div>
              {(recentArticles as any[]).map((a: any) => {
                const colors: Record<string, string> = {
                  published: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                  draft: 'bg-ink-100 text-ink-600 dark:bg-dark-50 dark:text-slate-500',
                  scheduled: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                }
                return (
                  <Link key={a.id} href={`/admin/articles/${a.id}/edit`}
                    className="group flex items-center gap-3 px-5 py-3 border-b border-ink-50 dark:border-dark-border last:border-0 hover:bg-ink-50/50 dark:hover:bg-dark-50/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink-900 dark:text-slate-100 truncate group-hover:text-accent dark:group-hover:text-red-400 transition-colors">{a.title}</p>
                      <p className="text-xs text-ink-400 dark:text-slate-600 mt-0.5">{a.category_name || 'Uncategorized'} {a.published_at ? '· ' + new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</p>
                    </div>
                    <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors[a.status] ?? colors.draft}`}>{a.status}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="lg:col-span-2 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-400 dark:text-slate-600 px-0.5">Quick Actions</p>
          <div className="space-y-2">
            <QuickAction href="/admin/articles/new" icon="✏️" label="New Article" desc="Start writing" accent />
            <QuickAction href="/admin/ai-writer"    icon="✦"  label="AI Writer"   desc="Generate content" />
            <QuickAction href="/admin/trends"       icon="🔥" label="Trending Now" desc="What's hot today" />
            <QuickAction href="/admin/seo"          icon="◈"  label="SEO Engine"  desc="Optimize articles" />
            <QuickAction href="/admin/revenue"      icon="💰" label="Earnings"    desc="Revenue overview" />
            <QuickAction href="/admin/monetization/site-scripts" icon="🔧" label="Site Scripts" desc="Inject ad tags" />
          </div>
        </div>
      </div>
    </div>
  )
}
