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
        {process.env.NEXT_PUBLIC_ADSENSE_CLIENT && (
          <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}`} crossOrigin="anonymous" />
        )}
      </head>
      <body className="bg-white text-ink-950 antialiased">
        {children}
        <Toaster position="top-right" toastOptions={{ style: { fontSize: 13, background: '#111', color: '#f0f0ee', border: '1px solid #333' } }} />
      </body>
    </html>
  )
}
