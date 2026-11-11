export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: { template: '%s | TrendingVerse', default: 'TrendingVerse — Breaking News & Trending Stories' },
  description: 'Stay ahead with TrendingVerse — the latest breaking news, trending stories, and in-depth analysis.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL||'https://trendingverse.online'),
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        {/* Inline script: apply dark class before first paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('tv-theme');if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})()` }} />
        {process.env.NEXT_PUBLIC_ADSENSE_CLIENT && (
          <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}`} crossOrigin="anonymous" />
        )}
      </head>
      <body className="antialiased">
        {children}
        <Toaster position="top-right" toastOptions={{ style: { fontSize: 13, background: '#0f172a', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' } }} />
      </body>
    </html>
  )
}
