// app/api/admin/video-assets/route.ts
// Lists all files in the video-ads Supabase Storage bucket for the Media Library videos tab
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
const BUCKET = 'video-ads'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: files, error } = await admin.storage.from(BUCKET).list('', {
    limit: 200,
    sortBy: { column: 'created_at', order: 'desc' },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const enriched = (files || [])
    .filter(f => f.name !== '.emptyFolderPlaceholder')
    .map(f => {
      const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(f.name)
      const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(f.name)
      return {
        id: f.id,
        name: f.name,
        url: publicUrl,
        size: f.metadata?.size || 0,
        mime_type: f.metadata?.mimetype || (isVideo ? 'video/mp4' : 'image/jpeg'),
        created_at: f.created_at,
        is_video: isVideo,
      }
    })

  return NextResponse.json(enriched)
}
