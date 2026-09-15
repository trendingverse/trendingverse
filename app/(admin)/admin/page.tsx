// app/(admin)/admin/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function sq(fn: () => any, fb = 0): Promise<number> {
  try { const r = await fn(); return r?.error ? fb : (r?.count ?? fb) } catch { return fb }
}
async function qData<T>(fn: () => any): Promise<T[]> {
  try { const r = await fn(); return r?.data ?? [] } catch { return [] }
}

// OneAds-style stat card
function KpiCard({ icon, iconBg, value, label }: { icon: string; iconBg: string; value: string | number; label: string }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-black text-ink-950 dark:text-white leading-none">{value}</p>
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-400 dark:text-slate-600 mt-1">{label}</p>
      </div>
    </div>
  )
}

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const todayISO = new Date().toISOString().slice(0, 10)
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user.email?.split('@')[0] ?? 'there'

  const [total, published, drafts, todayPub, articles] = await Promise.all([
    sq(() => supabase.from('articles').select('*', { count: 'exact', head: true })),
    sq(() => supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'published')),
    sq(() => supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'draft')),
    sq(() => supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'published').gte('published_at', todayISO + 'T00:00:00Z')),
    qData<any>(() => supabase.from('articles').select('id,title,status,published_at,category_name').order('created_at', { ascending: false }).limit(8)),
  ])

  const STATUS_BADGE: Record<string, string> = {
    published: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400',
    draft:     'bg-ink-100 text-ink-600 dark:bg-navy-600 dark:text-slate-400',
    scheduled: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  }

  return (
    <div className="space-y-6 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-ink-400 dark:text-slate-600 mb-1">
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <h1 className="text-2xl font-black text-ink-950 dark:text-white">
            {greeting}, {firstName} 👋
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/trends" className="btn btn-secondary">
            🔥 Trends
          </Link>
          <Link href="/admin/articles/new" className="btn btn-primary">
            + New Article
          </Link>
        </div>
      </div>

      {/* KPI cards — OneAds style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon="📄" iconBg="bg-blue-100 dark:bg-blue-900/30"   value={total}     label="Total Articles" />
        <KpiCard icon="✅" iconBg="bg-emerald-100 dark:bg-emerald-900/30" value={published} label="Published" />
        <KpiCard icon="✏️" iconBg="bg-amber-100 dark:bg-amber-900/30"  value={drafts}    label="Drafts" />
        <KpiCard icon="🚀" iconBg="bg-red-100 dark:bg-red-900/20"      value={todayPub}  label="Published Today" />
      </div>

      {/* Main content */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Recent articles */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 dark:border-navy-border">
            <div>
              <p className="font-bold text-ink-950 dark:text-white text-sm">Recent Articles</p>
              <p className="text-[11px] text-ink-400 dark:text-slate-600 mt-0.5">Latest content across all publishers</p>
            </div>
            <Link href="/admin/articles" className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors">
              View all →
            </Link>
          </div>
          {articles.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-ink-400 dark:text-slate-600 text-sm">No articles yet</p>
              <Link href="/admin/articles/new" className="text-accent text-sm mt-2 inline-block font-medium">Write your first article →</Link>
            </div>
          ) : articles.map((a: any) => (
            <Link key={a.id} href={`/admin/articles/${a.id}/edit`}
              className="group flex items-center gap-3 px-5 py-3.5 border-b border-ink-50 dark:border-navy-border last:border-0 hover:bg-ink-50 dark:hover:bg-navy-700 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-900 dark:text-slate-100 truncate group-hover:text-accent dark:group-hover:text-red-400 transition-colors">
                  {a.title}
                </p>
                <p className="text-xs text-ink-400 dark:text-slate-600 mt-0.5">
                  {a.category_name || 'Uncategorized'}
                  {a.published_at && ` · ${new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </p>
              </div>
              <span className={`flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${STATUS_BADGE[a.status] ?? STATUS_BADGE.draft}`}>
                {a.status}
              </span>
            </Link>
          ))}
        </div>

        {/* Quick actions */}
        <div className="space-y-3">
          <div className="card p-5">
            <p className="font-bold text-ink-950 dark:text-white text-sm mb-1">Quick Actions</p>
            <p className="text-[11px] text-ink-400 dark:text-slate-600 mb-4">Jump to common tasks</p>
            <div className="space-y-2">
              {[
                { href: '/admin/articles/new', icon: '✏️', label: 'New Article',   accent: true },
                { href: '/admin/ai-writer',    icon: '⚡', label: 'AI Writer'           },
                { href: '/admin/trends',       icon: '🔥', label: 'Trending Topics'     },
                { href: '/admin/seo',          icon: '🎯', label: 'SEO Engine'           },
                { href: '/admin/revenue',      icon: '💰', label: 'Earnings'             },
                { href: '/admin/monetization/site-scripts', icon: '🔧', label: 'Site Scripts' },
                { href: '/admin/outreach',     icon: '📋', label: 'Outreach'             },
              ].map(a => (
                <Link key={a.href} href={a.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    a.accent
                      ? 'bg-accent text-white hover:bg-accent-hover shadow-sm'
                      : 'text-ink-700 dark:text-slate-300 hover:bg-ink-100 dark:hover:bg-navy-700 hover:text-ink-900 dark:hover:text-white'
                  }`}>
                  <span className="text-base w-5 text-center">{a.icon}</span>
                  <span className="flex-1">{a.label}</span>
                  <span className="text-[10px] opacity-40">→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
