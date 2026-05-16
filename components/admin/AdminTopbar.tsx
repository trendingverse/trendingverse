'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
export function AdminTopbar({ user }: { user: User }) {
  const router = useRouter()
  const supabase = createClient()
  async function signOut() { await supabase.auth.signOut(); router.push('/login'); router.refresh() }
  return (
    <div className="h-14 border-b border-ink-100 bg-white flex items-center justify-between px-6 shrink-0">
      <Link href="/admin/articles/new" className="btn-primary btn-sm">+ New Article</Link>
      <div className="flex items-center gap-4">
        <span className="text-xs text-ink-400 hidden sm:block">{user.email}</span>
        <button onClick={signOut} className="text-xs text-ink-400 hover:text-accent transition-colors">Sign out</button>
      </div>
    </div>
  )
}
