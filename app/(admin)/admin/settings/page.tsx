import { createClient } from '@/lib/supabase/server'
import { SettingsPanel } from '@/components/admin/SettingsPanel'
export default async function SettingsPage() {
  const supabase = await createClient()
  const [{ data: settings }, { data: subscribers }, { data: campaigns }] = await Promise.all([
    supabase.from('site_settings').select('*'),
    supabase.from('newsletter_subscribers').select('id,email,name,is_active,subscribed_at').order('subscribed_at',{ascending:false}),
    supabase.from('newsletter_campaigns').select('*').order('created_at',{ascending:false}),
  ])
  const settingsMap = Object.fromEntries((settings||[]).map(s => [s.key, s.value]))
  return (<div><div className="mb-6"><h1 className="text-2xl font-bold text-ink-950">Settings</h1><p className="text-sm text-ink-400">Site settings, newsletter, and integrations.</p></div><SettingsPanel settings={settingsMap} subscribers={subscribers||[]} campaigns={campaigns||[]} /></div>)
}
