import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await admin
    .from('user_profiles')
    .select('publisher_api_key')
    .eq('id', user.id)
    .single()

  // Auto-generate key if missing
  if (!profile?.publisher_api_key) {
    const newKey = 'tvp_' + Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('hex')
    await admin
      .from('user_profiles')
      .update({ publisher_api_key: newKey })
      .eq('id', user.id)
    return NextResponse.json({ publisher_api_key: newKey })
  }

  return NextResponse.json({ publisher_api_key: profile.publisher_api_key })
}
