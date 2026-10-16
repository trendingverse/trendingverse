import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
})

export const metadata: Metadata = {
  title: { template: '%s | TrendingVerse', default: 'TrendingVerse — Breaking News & Trending Stories' },
  description: 'Stay ahead with TrendingVerse — the latest breaking news, trending stories, and in-depth analysis.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL||'https://trendingverse.online'),
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
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
