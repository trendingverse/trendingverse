import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PasteEnrich } from '@/components/admin/PasteEnrich'

export default async function PasteEnrichPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="space-y-6">
      <PasteEnrich />
    </div>
  )
}
