// app/api/admin/publishers/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Only fetch publisher role — exclude admin and advertiser
  const { data: profiles } = await admin
    .from('user_profiles')
    .select('id, full_name, plan, subscription_status, articles_used_today, created_at, role')
    .or('role.eq.publisher,role.is.null')
    .order('created_at', { ascending: false })

  if (!profiles?.length) return NextResponse.json({ publishers: [], total: 0 })

  const { data: articleCounts } = await admin.from('articles').select('user_id')
  const { data: sites } = await admin.from('sites').select('user_id, name, site_url, articles_count')
  const { data: authData } = await admin.auth.admin.listUsers()
  const authUsers = authData?.users || []

  const publishers = profiles.map(profile => {
    const authUser = authUsers.find(u => u.id === profile.id)
    const userArticles = (articleCounts || []).filter(a => a.user_id === profile.id)
    const userSites = (sites || []).filter(s => s.user_id === profile.id)
    return {
      id: profile.id,
      email: authUser?.email || 'unknown',
      full_name: profile.full_name || 'Unknown',
      plan: profile.plan || 'free',
      subscription_status: profile.subscription_status || 'inactive',
      articles_total: userArticles.length,
      articles_today: profile.articles_used_today || 0,
      sites: userSites,
      sites_count: userSites.length,
      joined_at: profile.created_at,
      last_sign_in: authUser?.last_sign_in_at || null,
    }
  })

  const stats = {
    total_publishers: publishers.length,
    pro_publishers: publishers.filter(p => p.plan === 'pro').length,
    free_publishers: publishers.filter(p => p.plan === 'free').length,
    total_articles: (articleCounts || []).length,
    total_sites: (sites || []).length,
  }

  return NextResponse.json({ publishers, stats })
}
