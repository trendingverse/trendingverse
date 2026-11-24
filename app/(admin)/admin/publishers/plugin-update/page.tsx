export const runtime = 'edge'

// app/(admin)/admin/publishers/plugin-update/page.tsx
// Admin page: generate one-click plugin update links for publisher sites

import { createAdminClient } from '@/lib/supabase/admin'
import PluginUpdateClient from './PluginUpdateClient'

export default async function PluginUpdatePage() {
  const db = createAdminClient()

  const { data: publishers } = await db
    .from('publishers')
    .select('id, name, site_url, contact_email')
    .order('name')

  return <PluginUpdateClient publishers={publishers ?? []} />
}
