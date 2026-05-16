import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const days = parseInt(new URL(req.url).searchParams.get('days') || '14')
  const rows = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const { count } = await supabase.from('article_views')
      .select('*', { count: 'exact', head: true })
      .gte('viewed_at', dateStr + 'T00:00:00Z')
      .lte('viewed_at', dateStr + 'T23:59:59Z')
    rows.push({ date: dateStr.slice(5), views: count || 0 })
  }
  return NextResponse.json(rows)
}
