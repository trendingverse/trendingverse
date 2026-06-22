// app/api/admin/sync-wp-categories/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
const WP_BASE     = (process.env.WP_URL || '').replace(/\/$/, '')
const WP_AUTH     = Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`).toString('base64')
const WP_HEADERS  = { 'Authorization': `Basic ${WP_AUTH}` }

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1 — Fetch all WP categories → id to name map
  const catRes = await fetch(`${WP_BASE}/wp-json/wp/v2/categories?per_page=100`, { headers: WP_HEADERS })
  const wpCats = catRes.ok ? await catRes.json() : []
  const catIdToName: Record<number, string> = {}
  for (const c of wpCats) catIdToName[c.id] = c.name

  // 2 — Fetch ALL published WP posts (paginated), just id/slug/categories
  const wpPosts: { id: number; slug: string; categories: number[] }[] = []
  let page = 1
  while (true) {
    const res = await fetch(
      `${WP_BASE}/wp-json/wp/v2/posts?per_page=100&page=${page}&status=publish&_fields=id,slug,categories`,
      { headers: WP_HEADERS }
    )
    if (!res.ok) break
    const batch = await res.json()
    if (!Array.isArray(batch) || batch.length === 0) break
    wpPosts.push(...batch)
    if (batch.length < 100) break
    page++
    if (page > 20) break // safety cap — 2000 posts
  }

  const postBySlug: Record<string, { id: number; categories: number[] }> = {}
  for (const p of wpPosts) postBySlug[p.slug] = { id: p.id, categories: p.categories || [] }

  // 3 — Fetch all Supabase articles that need syncing
  const { data: articles } = await admin
    .from('articles')
    .select('id, slug, category_name, wp_post_id')
    .eq('status', 'published')

  let matched = 0, updated = 0, notFound = 0
  const notFoundSlugs: string[] = []

  for (const a of articles || []) {
    const wpPost = postBySlug[a.slug]
    if (!wpPost) {
      notFound++
      if (notFoundSlugs.length < 20) notFoundSlugs.push(a.slug)
      continue
    }
    matched++

    const categoryNames = wpPost.categories.map(id => catIdToName[id]).filter(Boolean)
    const primaryCategory = categoryNames[0] || null

    const needsUpdate = a.wp_post_id !== wpPost.id || a.category_name !== primaryCategory
    if (needsUpdate) {
      await admin.from('articles').update({
        wp_post_id: wpPost.id,
        category_name: primaryCategory,
      }).eq('id', a.id)
      updated++
    }
  }

  return NextResponse.json({
    total_articles: articles?.length || 0,
    total_wp_posts: wpPosts.length,
    matched,
    updated,
    not_found: notFound,
    not_found_sample_slugs: notFoundSlugs,
  })
}
