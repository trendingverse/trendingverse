// app/(admin)/admin/video/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { VideoGenerator } from '@/components/admin/VideoGenerator'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export default async function VideoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (user.email !== ADMIN_EMAIL) redirect('/admin')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">🎬 Article to Video</h1>
        <p className="text-sm text-ink-400 mt-1">Turn a published article into a short video for YouTube or Instagram</p>
      </div>
      <VideoGenerator />
    </div>
  )
}
