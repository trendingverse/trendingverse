import { NextResponse } from 'next/server'

export const runtime = 'edge'

// The ZIP is served directly as a static file from /public/downloads/
// This route just redirects to it so the old URL still works.
export async function GET() {
  return NextResponse.redirect(
    new URL('/downloads/trendingverse-ads.zip', 'https://trendingverse.online'),
    { status: 302 }
  )
}
