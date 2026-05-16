import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: asset } = await supabase.from('media_assets').select('storage_path').eq('id', id).single()
  if (asset?.storage_path) {
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'trendingverse-media'
    await admin.storage.from(bucket).remove([asset.storage_path])
  }
  const { error } = await supabase.from('media_assets').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
