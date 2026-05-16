import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
export async function middleware(r: NextRequest) { return await updateSession(r) }
export const config = { matcher: ['/admin/:path*','/login'] }
