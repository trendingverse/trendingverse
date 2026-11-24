import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://mvhlwhknxdazumpfxgki.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12aGx3aGtueGRhenVtcGZ4Z2tpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MjM4NDMsImV4cCI6MjA5NDQ5OTg0M30.5mF_6g-BCZMJHj07wW01ifaBdl6eu1h77O1VcwvQi4w',
    NEXT_PUBLIC_SITE_URL: 'https://trendingverse.online',
    SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12aGx3aGtueGRhenVtcGZ4Z2tpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODkyMzg0MywiZXhwIjoyMDk0NDk5ODQzfQ.RRn4l2vE9irfxWepJp94XPH-ZUqMWqiupIKKgyGpJZo',
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
}
export default nextConfig
