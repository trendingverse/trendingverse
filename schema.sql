-- ================================================================
-- TrendingVerse Complete Supabase Schema
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- ================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- CATEGORIES
create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null, slug text unique not null,
  description text, color text default '#e63946',
  meta_title text, meta_desc text, article_count int default 0,
  created_at timestamptz default now()
);
-- TAGS
create table if not exists public.tags (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null, slug text unique not null,
  created_at timestamptz default now()
);
-- MEDIA
create table if not exists public.media_assets (
  id uuid primary key default uuid_generate_v4(),
  filename text not null, original_name text not null,
  url text not null, storage_path text not null,
  mime_type text not null, size_bytes bigint default 0,
  width int, height int, alt_text text, caption text,
  folder text default 'general',
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
-- ARTICLES
create table if not exists public.articles (
  id uuid primary key default uuid_generate_v4(),
  title text not null, slug text unique not null,
  excerpt text, content text,
  cover_image_url text, cover_image_alt text,
  cover_image_id uuid references public.media_assets(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  category_name text,
  status text default 'draft' check (status in ('draft','scheduled','published','archived')),
  is_featured boolean default false,
  is_sponsored boolean default false, sponsor_name text, sponsor_disclosure text,
  author_id uuid references auth.users(id) on delete set null,
  author_name text default 'TrendingVerse Desk', author_avatar text,
  seo_title text, meta_description text, focus_keyword text,
  keywords text[] default '{}', canonical_url text, og_image_url text,
  schema_type text default 'NewsArticle',
  seo_score int default 0 check (seo_score between 0 and 100),
  discover_score int default 0,
  ai_generated boolean default false,
  published_at timestamptz, scheduled_at timestamptz,
  has_affiliate_links boolean default false,
  view_count bigint default 0,
  reading_time_min int default 1, word_count int default 0,
  related_article_ids uuid[] default '{}',
  created_at timestamptz default now(), updated_at timestamptz default now()
);
-- ARTICLE_TAGS
create table if not exists public.article_tags (
  article_id uuid references public.articles(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  primary key (article_id, tag_id)
);
-- SEO_METADATA
create table if not exists public.seo_metadata (
  article_id uuid primary key references public.articles(id) on delete cascade,
  title_score int default 0, content_score int default 0,
  keyword_score int default 0, readability_score int default 0,
  link_score int default 0, image_score int default 0, total_score int default 0,
  suggestions jsonb default '[]', keyword_density jsonb default '{}',
  internal_links int default 0, external_links int default 0,
  heading_structure jsonb default '{}', updated_at timestamptz default now()
);
-- AD_SLOTS
create table if not exists public.ad_slots (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  position text not null check (position in ('header','inline','sidebar','footer')),
  adsense_slot_id text, is_active boolean default true,
  custom_html text, description text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
-- AFFILIATE_LINKS
create table if not exists public.affiliate_links (
  id uuid primary key default uuid_generate_v4(),
  name text not null, url text not null,
  trigger_keywords text[] not null default '{}',
  is_active boolean default true, click_count int default 0,
  commission_pct numeric(5,2),
  category_id uuid references public.categories(id) on delete set null,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
-- ARTICLE_VIEWS
create table if not exists public.article_views (
  id bigserial primary key,
  article_id uuid references public.articles(id) on delete cascade,
  viewed_at timestamptz default now(),
  country text, device text, referrer text, session_id text
);
-- NEWSLETTER
create table if not exists public.newsletter_subscribers (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null, name text,
  is_active boolean default true, subscribed_at timestamptz default now()
);
create table if not exists public.newsletter_campaigns (
  id uuid primary key default uuid_generate_v4(),
  subject text not null, preview_text text,
  html_content text not null, status text default 'draft',
  sent_at timestamptz, sent_count int default 0,
  created_at timestamptz default now()
);
-- SITE_SETTINGS
create table if not exists public.site_settings (
  key text primary key, value text, label text,
  category text default 'general', updated_at timestamptz default now()
);
-- SCHEDULED_JOBS
create table if not exists public.scheduled_jobs (
  id uuid primary key default uuid_generate_v4(),
  job_type text not null, payload jsonb default '{}',
  run_at timestamptz not null, ran_at timestamptz,
  status text default 'pending', error text,
  created_at timestamptz default now()
);

-- INDEXES
create index if not exists idx_articles_slug on public.articles(slug);
create index if not exists idx_articles_status on public.articles(status);
create index if not exists idx_articles_category on public.articles(category_id);
create index if not exists idx_articles_published on public.articles(published_at desc);
create index if not exists idx_articles_featured on public.articles(is_featured) where is_featured=true;
create index if not exists idx_articles_search on public.articles using gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(excerpt,'')));
create index if not exists idx_views_article on public.article_views(article_id);
create index if not exists idx_views_date on public.article_views(viewed_at desc);
create index if not exists idx_article_tags on public.article_tags(article_id);
create index if not exists idx_scheduled_jobs on public.scheduled_jobs(run_at) where status='pending';

-- TRIGGERS
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
create trigger trg_articles_updated before update on public.articles for each row execute function public.touch_updated_at();

create or replace function public.increment_article_view()
returns trigger language plpgsql as $$
begin update public.articles set view_count=view_count+1 where id=new.article_id; return new; end; $$;
create trigger trg_view_count after insert on public.article_views for each row execute function public.increment_article_view();

create or replace function public.sync_category_count() returns trigger language plpgsql as $$
begin
  if TG_OP='INSERT' and new.status='published' and new.category_id is not null then
    update public.categories set article_count=article_count+1 where id=new.category_id;
  elsif TG_OP='UPDATE' then
    if old.status<>'published' and new.status='published' and new.category_id is not null then
      update public.categories set article_count=article_count+1 where id=new.category_id;
    elsif old.status='published' and new.status<>'published' and old.category_id is not null then
      update public.categories set article_count=greatest(0,article_count-1) where id=old.category_id;
    end if;
  elsif TG_OP='DELETE' and old.status='published' and old.category_id is not null then
    update public.categories set article_count=greatest(0,article_count-1) where id=old.category_id;
  end if;
  return coalesce(new,old);
end; $$;
create trigger trg_cat_count after insert or update or delete on public.articles for each row execute function public.sync_category_count();

-- Stored procedure for daily views chart
create or replace function public.get_daily_views(days_back int default 14)
returns table(date text, views bigint) language sql stable as $$
  select to_char(d::date,'Mon DD') as date, count(av.id) as views
  from generate_series(now()::date - (days_back-1), now()::date, '1 day'::interval) d
  left join public.article_views av on av.viewed_at::date = d::date
  group by d order by d;
$$;

-- RLS
alter table public.articles enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.media_assets enable row level security;
alter table public.article_tags enable row level security;
alter table public.seo_metadata enable row level security;
alter table public.ad_slots enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.article_views enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_campaigns enable row level security;
alter table public.site_settings enable row level security;
alter table public.scheduled_jobs enable row level security;

create policy "public_read_published" on public.articles for select to anon using (status='published');
create policy "public_read_categories" on public.categories for select to anon using (true);
create policy "public_read_tags" on public.tags for select to anon using (true);
create policy "public_read_ad_slots" on public.ad_slots for select to anon using (is_active=true);
create policy "public_read_affiliate" on public.affiliate_links for select to anon using (is_active=true);
create policy "public_read_settings" on public.site_settings for select to anon using (true);
create policy "public_insert_views" on public.article_views for insert to anon with check (true);
create policy "public_insert_subscribers" on public.newsletter_subscribers for insert to anon with check (true);
create policy "admin_all_articles" on public.articles for all to authenticated using (true) with check (true);
create policy "admin_all_categories" on public.categories for all to authenticated using (true) with check (true);
create policy "admin_all_tags" on public.tags for all to authenticated using (true) with check (true);
create policy "admin_all_media" on public.media_assets for all to authenticated using (true) with check (true);
create policy "admin_all_article_tags" on public.article_tags for all to authenticated using (true) with check (true);
create policy "admin_all_seo" on public.seo_metadata for all to authenticated using (true) with check (true);
create policy "admin_all_ad_slots" on public.ad_slots for all to authenticated using (true) with check (true);
create policy "admin_all_affiliate" on public.affiliate_links for all to authenticated using (true) with check (true);
create policy "admin_all_views" on public.article_views for all to authenticated using (true) with check (true);
create policy "admin_all_subscribers" on public.newsletter_subscribers for all to authenticated using (true) with check (true);
create policy "admin_all_campaigns" on public.newsletter_campaigns for all to authenticated using (true) with check (true);
create policy "admin_all_settings" on public.site_settings for all to authenticated using (true) with check (true);
create policy "admin_all_scheduled" on public.scheduled_jobs for all to authenticated using (true) with check (true);

-- SEED
insert into public.categories (name,slug,description,color) values
  ('Technology','technology','Latest in tech, AI, and digital innovation','#6366f1'),
  ('Business','business','Markets, economy, and corporate news','#0ea5e9'),
  ('Politics','politics','World politics and government affairs','#e63946'),
  ('Science','science','Scientific discoveries and research','#10b981'),
  ('Health','health','Health, wellness, and medicine','#f59e0b'),
  ('Sports','sports','Sports news and analysis','#8b5cf6'),
  ('Entertainment','entertainment','Movies, TV, music and pop culture','#ec4899'),
  ('World','world','International news and global affairs','#64748b')
on conflict (slug) do nothing;

insert into public.ad_slots (name,position,is_active,description) values
  ('Header Banner','header',true,'728x90 leaderboard at top of every page'),
  ('In-Article Ad','inline',true,'336x280 rectangle after 3rd paragraph'),
  ('Sidebar Top','sidebar',true,'300x250 in article sidebar'),
  ('Footer Banner','footer',true,'728x90 at page footer')
on conflict do nothing;

insert into public.site_settings (key,value,label,category) values
  ('site_name','TrendingVerse','Site Name','general'),
  ('tagline','Breaking News & Trending Stories','Tagline','general'),
  ('site_url','https://trendingverse.online','Site URL','general'),
  ('articles_per_page','12','Articles Per Page','general'),
  ('adsense_client','','AdSense Publisher ID','monetization'),
  ('footer_text','© 2025 TrendingVerse. All rights reserved.','Footer Text','general'),
  ('twitter_handle','@trendingverse','Twitter Handle','social'),
  ('og_default_image','','Default OG Image URL','seo')
on conflict (key) do nothing;

-- Storage bucket (run separately in Supabase dashboard or via API)
-- insert into storage.buckets (id,name,public) values ('trendingverse-media','trendingverse-media',true) on conflict do nothing;

-- ── DAILY VIEWS RPC (for dashboard chart) ──────────────────────
create or replace function public.get_daily_views(days_back int default 14)
returns table(date text, views bigint)
language sql stable as $$
  select
    to_char(date_trunc('day', viewed_at), 'Mon DD') as date,
    count(*) as views
  from public.article_views
  where viewed_at >= now() - (days_back || ' days')::interval
  group by date_trunc('day', viewed_at)
  order by date_trunc('day', viewed_at);
$$;
