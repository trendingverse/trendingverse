import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsPanel } from '@/components/admin/SettingsPanel'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load THIS user's settings only
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', user.id)
    .single()

  // Load THIS user's sites only
  const { data: sites } = await supabase
    .from('sites')
    .select('id, name, site_url, wp_username, wp_app_password')
    .eq('user_id', user.id)
    .order('created_at')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">⚙ Settings</h1>
        <p className="text-sm text-ink-400 mt-1">Your site settings, integrations and API keys</p>
      </div>
<SettingsPanel
  settings={userSettings?.settings || {}}
  subscribers={[]}
  campaigns={[]}
/>
    </div>
  )
}
