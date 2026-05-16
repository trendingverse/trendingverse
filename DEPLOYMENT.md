# TrendingVerse — Complete Deployment Guide

## Architecture Overview

```
trendingverse.online
├── Next.js 15 (App Router) — Vercel
├── Supabase PostgreSQL — Database + Auth + Storage
├── Gemini API — AI content generation
└── Google AdSense — Monetization
```

---

## Step 1 — Supabase Setup

1. Go to https://supabase.com → New Project
   - Name: `trendingverse`
   - Region: Asia South (Mumbai) for India audience
   - Save your DB password

2. **Run the schema:**
   - Dashboard → SQL Editor → New Query
   - Paste entire contents of `schema.sql`
   - Click **Run**

3. **Create Storage bucket:**
   - Dashboard → Storage → New Bucket
   - Name: `trendingverse-media`
   - Public: **Yes** (checked)
   - Max upload size: 10MB

4. **Create admin user:**
   - Dashboard → Authentication → Users → Invite User
   - Enter your admin email
   - Check your email and set password

5. **Get credentials:**
   - Project Settings → API
   - Copy: Project URL, anon key, service_role key

---

## Step 2 — Gemini API Key

1. Go to https://aistudio.google.com/apikey
2. Create API key
3. Copy the key (starts with `AIza...`)

---

## Step 3 — Vercel Deployment

1. Push this repo to GitHub:
```bash
git init
git add .
git commit -m "Initial TrendingVerse deployment"
git remote add origin https://github.com/YOUR_USERNAME/trendingverse.git
git push -u origin main
```

2. Go to https://vercel.com → New Project → Import from GitHub

3. **Environment Variables** (add all of these in Vercel):

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=https://trendingverse.online
NEXT_PUBLIC_SITE_NAME=TrendingVerse
GEMINI_API_KEY=AIza...
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=trendingverse-media
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
NEXT_PUBLIC_ADSENSE_HEADER_SLOT=XXXXXXXXXX
NEXT_PUBLIC_ADSENSE_INLINE_SLOT=XXXXXXXXXX
NEXT_PUBLIC_ADSENSE_SIDEBAR_SLOT=XXXXXXXXXX
RESEND_API_KEY=re_...
NEWSLETTER_FROM_EMAIL=newsletter@trendingverse.online
```

4. Click **Deploy**

5. After deploy, add custom domain:
   - Vercel → Settings → Domains → Add `trendingverse.online`
   - Update DNS at your registrar per Vercel's instructions

---

## Step 4 — Post-Deployment Setup

1. Visit `https://trendingverse.online/login`
2. Sign in with your admin email
3. Go to **Admin → Categories** — your 8 default categories are pre-seeded
4. Go to **Admin → Settings** → fill in Site Name, URL, AdSense ID
5. Go to **Admin → AI Writer** → create your first article
6. Go to **Admin → Monetization** → configure AdSense slots

---

## Step 5 — Google AdSense

1. Apply at https://adsense.google.com
2. Once approved, get your publisher ID (`ca-pub-XXXX`)
3. Get slot IDs for Header, Inline, Sidebar ads
4. Add to Vercel environment variables
5. Redeploy (Vercel → Deployments → Redeploy)

---

## Step 6 — Article Scheduling (Cron)

`vercel.json` is already configured with a cron job that runs every minute to publish scheduled articles. This works automatically on Vercel Pro/Team plans.

For free plans, use an external cron service (cron-job.org) to call:
```
GET https://trendingverse.online/api/schedule
```
Every 5 minutes.

---

## Post-Deployment Checklist

- [ ] Admin login works at /login
- [ ] Created at least one article and it appears on homepage
- [ ] Category pages load correctly
- [ ] Article pages show correct SEO metadata
- [ ] AdSense script loads (check browser source)
- [ ] Media upload works (Admin → Media → Upload)
- [ ] AI Writer generates content (Admin → AI Writer)
- [ ] SEO scores appear on articles
- [ ] Newsletter subscribe form works on footer
- [ ] Sitemap accessible at /sitemap.xml
- [ ] Robots.txt accessible at /robots.txt
- [ ] Google Search Console → Submit sitemap
- [ ] Google Analytics → Add GA4 ID in Settings

---

## Affiliate Link Setup

1. Admin → Monetization → Affiliate Links → Add New
2. Enter name, URL, and trigger keywords
3. Example: name=Amazon, url=https://amzn.to/XXX, keywords=["buy","price","deal"]
4. Affiliate links are automatically injected into article content when keywords match

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | ✅ | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | ✅ | Supabase anon key |
| SUPABASE_SERVICE_ROLE_KEY | ✅ | Supabase service role (server only) |
| GEMINI_API_KEY | ✅ | Google Gemini AI key |
| NEXT_PUBLIC_SITE_URL | ✅ | Your domain URL |
| NEXT_PUBLIC_ADSENSE_CLIENT | ⚡ | AdSense publisher ID |
| NEXT_PUBLIC_ADSENSE_*_SLOT | ⚡ | AdSense slot IDs |
| RESEND_API_KEY | 📧 | Email newsletter (optional) |
| OPENAI_API_KEY | 🔄 | OpenAI fallback (optional) |
