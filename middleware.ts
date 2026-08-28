// middleware.ts
// Intentionally minimal — all auth handled by app/(admin)/admin/layout.tsx
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  return NextResponse.next()
}

// Empty matcher = middleware runs for nothing
export const config = {
  matcher: [],
}
