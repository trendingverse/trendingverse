// app/api/admin/backfill-seo-scores/route.ts
// One-time (re-runnable) route that recomputes seo_score for existing
// articles using the current algorithmic scorer, so old rows stop showing
// stale scores in the article list. Safe to run multiple times.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { computeSeoScore } from '@/lib/seo-scorer'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '200')
  const dryRun = searchParams.get('dry_run') === 'true'
  const isAdmin = user.email === ADMIN_EMAIL

  // Admins can backfill all articles; regular users only their own
  let query = admin
    .from('articles')
    .select('id, title, seo_title, content, meta_description, focus_keyword, excerpt, seo_score')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!isAdmin) query = query.eq('user_id', user.id)

  const { data: articles, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!articles?.length) return NextResponse.json({ message: 'No articles found', updated: 0 })

  let updated = 0
  const changes: any[] = []

  for (const a of articles) {
    const result = computeSeoScore({
      title: a.seo_title || a.title || '',
      content: a.content || '',
      metaDescription: a.meta_description || '',
      focusKeyword: a.focus_keyword || '',
      excerpt: a.excerpt || '',
    })

    if (result.total !== a.seo_score) {
      changes.push({ id: a.id, title: (a.title || '').slice(0, 50), old: a.seo_score, new: result.total, grade: result.grade })
      if (!dryRun) {
        await admin.from('articles').update({ seo_score: result.total }).eq('id', a.id)
        updated++
      }
    }
  }

  return NextResponse.json({
    dry_run: dryRun,
    total_checked: articles.length,
    changed: changes.length,
    updated,
    changes: changes.slice(0, 50),
  })
}
