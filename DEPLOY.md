# TrendingVerse — Complete Deployment Guide

## System Architecture
```
Next.js 15 (App Router) — Vercel
Supabase PostgreSQL     — Database + Auth + Storage
Gemini AI               — Content generation
Google AdSense          — Monetization
```

## Full Folder Structure
```
trendingverse/
├── app/
│   ├── (admin)/admin/         ← Protected admin routes
│   │   ├── page.tsx           ← Dashboard
│   │   ├── articles/          ← Article management
│   │   ├── ai-writer/         ← AI content tools
│   │   ├── seo/               ← SEO engine
│   │   ├── media/             ← Media library
│   │   ├── monetization/      ← Ads + affiliate
│   │   ├── categories/        ← Category management
│   │   └── settings/          ← Site settings
│   ├── (public)/              ← Public website
│   │   ├── page.tsx           ← Homepage
│   │   ├── article/[slug]/    ← Article page
│   │   ├── [category]/        ← Category pages
│   │   └── search/            ← Search page
│   ├── api/                   ← REST API routes
│   │   ├── articles/          ← CRUD articles
│   │   ├── ai/                ← Gemini AI endpoints
│   │   ├── media/             ← File uploads
│   │   ├── categories/, tags/
│   │   ├── adslots/, affiliate/
│   │   ├── views/, analytics/
│   │   ├── newsletter/
│   │   └── schedule/          ← Auto-publish cron
│   ├── login/                 ← Admin login
│   ├── sitemap.ts             ← Auto sitemap
│   └── robots.ts
├── components/
│   ├── admin/                 ← All admin UI components
│   └── public/                ← Public website components
├── lib/
│   ├── supabase/              ← Client, server, admin, middleware
│   ├── ai/gemini.ts           ← Gemini AI integration
│   └── utils/                 ← SEO score, slug, helpers
├── types/index.ts
├── schema.sql                 ← Complete database schema
├── middleware.ts              ← Route protection
├── vercel.json                ← Cron jobs + headers
└── .env.example
```

---

## STEP 1 — Supabase Setup

1. Go to https://supabase.com → New Project
2. Name: `trendingverse` · Region: Southeast Asia (Mumbai)
3. **SQL Editor → New Query → Paste entire `schema.sql` → Run**
4. Go to **Storage → New Bucket**
   - Name: `trendingverse-media`
   - Public: ✅ Yes
5. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon / public` key
   - `service_role` key (keep secret!)
6. Go to **Auth → Settings**:
   - Disable email confirmations for easier admin setup
   - Go to **Auth → Users → Add User** → create your admin email/password

---

## STEP 2 — Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

GEMINI_API_KEY=AIza...

NEXT_PUBLIC_SITE_URL=https://trendingverse.online
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=trendingverse-media

# Optional
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
NEXT_PUBLIC_ADSENSE_HEADER_SLOT=XXXXXXXXXX
NEXT_PUBLIC_ADSENSE_INLINE_SLOT=XXXXXXXXXX
NEXT_PUBLIC_ADSENSE_SIDEBAR_SLOT=XXXXXXXXXX

CRON_SECRET=your-random-secret-string
```

---

## STEP 3 — Gemini AI Setup

1. Go to https://aistudio.google.com/app/apikey
2. Create API key → copy to `GEMINI_API_KEY`
3. Free tier: 15 RPM, 1M tokens/day — sufficient for most publishers
4. Upgrade to Gemini 1.5 Pro for higher quality if needed

---

## STEP 4 — Deploy to Vercel

```bash
# Install dependencies
npm install

# Test locally
npm run dev
# Visit: http://localhost:3000
# Admin: http://localhost:3000/login

# Deploy to Vercel
npm install -g vercel
vercel --prod

# Or connect GitHub repo in Vercel dashboard
# Settings → Environment Variables → add all from .env.local
```

Set these in **Vercel Dashboard → Settings → Environment Variables**:
- All vars from `.env.example`
- Add `CRON_SECRET` for scheduled publishing

---

## STEP 5 — Custom Domain

1. Vercel Dashboard → Domains → Add `trendingverse.online`
2. Update DNS at your registrar:
   - A record: `76.76.21.21`
   - CNAME: `www` → `cname.vercel-dns.com`
3. Update `NEXT_PUBLIC_SITE_URL` to `https://trendingverse.online`

---

## STEP 6 — Google AdSense

1. Apply at https://adsense.google.com
2. Add your site URL
3. Add the AdSense script (auto-added if `NEXT_PUBLIC_ADSENSE_CLIENT` is set)
4. Once approved, go to **Admin → Monetization → Ad Slots**
5. Enter each slot ID from your AdSense dashboard
6. Slots auto-appear on: header, in-article, sidebar

---

## STEP 7 — Post-Deployment Checklist

- [ ] Login at `/login` with the admin account you created
- [ ] Go to **Settings → General** → update site name, tagline, URL
- [ ] Go to **Categories** → edit/add your content categories
- [ ] Go to **Monetization → Ad Slots** → add your AdSense slot IDs
- [ ] Go to **AI Writer** → test article generation with your Gemini key
- [ ] Create your first article: **Articles → New Article**
- [ ] Check **SEO Engine** → all articles should show SEO scores
- [ ] Submit sitemap to Google Search Console: `https://trendingverse.online/sitemap.xml`
- [ ] Set up Google Analytics → add GA4 ID in **Settings → Integrations**
- [ ] Test newsletter subscription from the public homepage footer
- [ ] Test article scheduling: create article → set status "Scheduled" + date/time

---

## Auto-Publish Scheduler

Vercel cron runs `/api/schedule` every 5 minutes automatically.
Set `CRON_SECRET` env var and it processes scheduled articles.

## Affiliate Links

1. Admin → Monetization → Affiliate Links → Add Link
2. Enter trigger keywords (comma-separated)
3. Keywords auto-detected in published articles → links auto-inserted

## SEO Engine

- Every article shows a live 0–100 SEO score in the editor
- Admin → SEO Engine → shows all articles sorted by score
- Click any article → "AI Enhance SEO" → Gemini fixes everything automatically

---

*Built with Next.js 15 · Supabase · Gemini AI · Tailwind CSS · Vercel*
