// lib/article-generation-prompt.ts
// Single source of truth for the article generation prompt used across
// AI Writer, Trends, and the auto-publish cron. Every article generated
// using this prompt will satisfy the algorithmic SEO scorer by construction.

export function buildArticlePrompt(params: {
  title: string
  category: string
  keywords: string[]
  language: string
  focusKeyword?: string
}): string {
  const { title, category, keywords, language, focusKeyword } = params
  const kw = focusKeyword || keywords[0] || title.split(' ').slice(0, 3).join(' ')

  return `You are a senior journalist for TrendingVerse, an Indian news platform.
Write a complete, original, SEO-optimized news article in ${language}.

ARTICLE BRIEF:
- Title: ${title}
- Category: ${category}
- Focus keyword: "${kw}"
- Related keywords: ${keywords.join(', ')}
- Language: ${language}

MANDATORY SEO REQUIREMENTS — the article MUST satisfy ALL of these:

1. WORD COUNT: Write 750-900 words of actual body content. Count carefully.

2. OPENING PARAGRAPH: The very first paragraph must naturally include the focus keyword "${kw}" within the first 3 sentences.

3. STRUCTURE — use this exact HTML structure:
   - One <h1> tag for the main title (containing the focus keyword)
   - At least 3 <h2> subheadings that break the article into clear sections
   - Body paragraphs in <p> tags
   - Use <strong> for the focus keyword on its first 2-3 appearances
   - At least one <ul> or <ol> list somewhere in the article

4. KEYWORD DENSITY: Use the focus keyword "${kw}" naturally 4-6 times throughout the article (0.5%-2% density). Do NOT stuff keywords — only use them where they read naturally.

5. LINKS: Include at least one <a href="https://trendingverse.online" target="_blank">TrendingVerse</a> link naturally in the content.

6. TONE: Professional journalistic tone. E-E-A-T compliant. Google Discover ready. AdSense safe. No AI spam patterns. No filler phrases like "In conclusion" or "It is worth noting".

7. IMAGE PLACEHOLDER: At the very start of the content (before the first paragraph), include this exact HTML:
   <figure><img src="" alt="${kw} - ${category} news" width="1200" height="675" /></figure>
   (The src will be filled in by the publish pipeline — do NOT omit this.)

Return ONLY valid JSON, nothing else:
{
  "title": "Headline in ${language} containing focus keyword",
  "content": "Full HTML article — must start with the <figure> image placeholder, then <h1>, then body paragraphs with <h2> subheadings",
  "excerpt": "Compelling 90-110 character summary including the focus keyword",
  "seo_title": "50-60 char SEO title with focus keyword near the start",
  "meta_description": "Exactly 150-160 characters — describe the article, include a call to action, end with - TrendingVerse",
  "focus_keyword": "${kw}",
  "keywords": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "reading_time": 5
}`
}

// ── VALID CATEGORIES — single source of truth ──────────────────
export const VALID_CATEGORIES = [
  'Politics', 'Business', 'Technology', 'Entertainment', 'Sports',
  'Health', 'Science', 'Lifestyle', 'Education', 'World',
  'Crime', 'India', 'Environment', 'Finance', 'Trending',
]
