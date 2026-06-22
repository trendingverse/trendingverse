// app/api/admin/cleanup-non-english-currency/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
const WP_BASE     = (process.env.WP_URL || '').replace(/\/$/, '')
const WP_AUTH     = Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`).toString('base64')
const WP_HEADERS  = { 'Authorization': `Basic ${WP_AUTH}` }

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { searchParams } = new URL(req.url)
  const dryRun = searchParams.get('dry_run') !== 'false' // default true — must explicitly pass dry_run=false to actually delete

  // Find all non-English currency pages
  const { data: nonEnglishPages } = await admin
    .from('currency_pages')
    .select('id, base_currency, language, wp_post_id, wp_url')
    .neq('language', 'english')

  if (!nonEnglishPages || nonEnglishPages.length === 0) {
    return NextResponse.json({ message: 'No non-English currency pages found — nothing to clean up.' })
  }

  const results: any[] = []

  for (const page of nonEnglishPages) {
    const entry: any = {
      base_currency: page.base_currency,
      language: page.language,
      wp_url: page.wp_url,
      wp_post_id: page.wp_post_id,
    }

    if (dryRun) {
      entry.action = 'would delete (dry run)'
      results.push(entry)
      continue
    }

    // Move WP post to trash (recoverable for 30 days, safer than permanent delete)
    if (page.wp_post_id) {
      try {
        const res = await fetch(`${WP_BASE}/wp-json/wp/v2/posts/${page.wp_post_id}`, {
          method: 'DELETE',
          headers: WP_HEADERS,
        })
        entry.wp_deleted = res.ok
      } catch (e) {
        entry.wp_deleted = false
        entry.wp_error = (e as Error).message
      }
    } else {
      entry.wp_deleted = 'skipped (no wp_post_id on record)'
    }

    // Remove the Supabase row so the cron doesn't try to update a deleted post
    const { error } = await admin.from('currency_pages').delete().eq('id', page.id)
    entry.supabase_deleted = !error

    results.push(entry)
  }

  return NextResponse.json({
    dry_run: dryRun,
    total_found: nonEnglishPages.length,
    results,
  })
}
