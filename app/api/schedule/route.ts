import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Called by Vercel cron or external scheduler to publish scheduled articles
export async function GET() {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: scheduled, error } = await admin.from('articles')
    .select('id, title')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!scheduled?.length) return NextResponse.json({ published: 0 })

  const ids = scheduled.map(a => a.id)
  const { error: updateError } = await admin.from('articles')
    .update({ status: 'published', published_at: now })
    .in('id', ids)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Log completed jobs
  await admin.from('scheduled_jobs').insert(ids.map(id => ({
    job_type: 'publish_article', payload: { article_id: id },
    run_at: now, ran_at: now, status: 'completed',
  })))

  return NextResponse.json({ published: ids.length, articles: scheduled.map(a => a.title) })
}
