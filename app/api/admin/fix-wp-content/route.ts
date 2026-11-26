export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Strip broken <figure><img src="non-url"> from WP post content
function stripBrokenImages(content: string): { fixed: string; changed: boolean } {
  const fixed = content.replace(
    /<figure[^>]*>\s*<img[^>]+src="([^"]*)"[^>]*>(?:<figcaption[^>]*>.*?<\/figcaption>)?\s*<\/figure>/gi,
    (match, src) => {
      // Keep the figure if src is a real URL
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/')) {
        return match
      }
      // Strip broken figure (src is article title text or empty non-URL)
      return ''
    }
  )
  return { fixed, changed: fixed !== content }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Dry-run mode: just preview what would change
  const { searchParams } = new URL(req.url)
  const dryRun = searchParams.get('dry') !== 'false'
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const limit = parseInt(searchParams.get('limit') || '10', 10)

  const wpBase = process.env.WP_BASE_URL || ''
  const wpUser = process.env.WP_USERNAME || ''
  const wpPass = process.env.WP_APP_PASSWORD || ''
  const auth = btoa(`${wpUser}:${wpPass}`)

  // Fetch posts from WP
  const postsRes = await fetch(
    `${wpBase}/wp-json/wp/v2/posts?per_page=${limit}&offset=${offset}&status=publish&_fields=id,title,content`,
    { headers: { Authorization: `Basic ${auth}` } }
  )
  if (!postsRes.ok) {
    return NextResponse.json({ error: `WP fetch failed: ${postsRes.status}` }, { status: 500 })
  }
  const posts: { id: number; title: { rendered: string }; content: { rendered: string } }[] = await postsRes.json()

  const results: { id: number; title: string; changed: boolean; dryRun: boolean }[] = []
  let updated = 0

  for (const post of posts) {
    const raw = post.content?.rendered || ''
    const { fixed, changed } = stripBrokenImages(raw)
    results.push({ id: post.id, title: post.title?.rendered || '', changed, dryRun })

    if (changed && !dryRun) {
      const updateRes = await fetch(`${wpBase}/wp-json/wp/v2/posts/${post.id}`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: fixed }),
      })
      if (updateRes.ok) updated++
    }
  }

  return NextResponse.json({
    offset,
    limit,
    total: posts.length,
    changed: results.filter(r => r.changed).length,
    updated,
    dryRun,
    results,
  })
}
