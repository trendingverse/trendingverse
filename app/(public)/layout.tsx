export const runtime = 'edge'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex flex-col overflow-x-hidden"><PublicHeader /><main className="flex-1 overflow-x-hidden">{children}</main><PublicFooter /></div>
}
