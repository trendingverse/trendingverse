import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase.from('media_assets').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const folder = (formData.get('folder') as string) || 'general'
  const altText = (formData.get('alt_text') as string) || ''

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
  if (!allowedTypes.includes(file.type)) return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })

  const ext = file.name.split('.').pop() || 'jpg'
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'trendingverse-media'

  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await admin.storage.from(bucket).upload(filename, bytes, { contentType: file.type, upsert: false })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from(bucket).getPublicUrl(filename)

  const { data: asset, error: dbError } = await supabase.from('media_assets').insert({
    filename, original_name: file.name, url: publicUrl,
    storage_path: filename, mime_type: file.type, size_bytes: file.size,
    alt_text: altText, folder, uploaded_by: user.id,
  }).select().single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(asset, { status: 201 })
}
