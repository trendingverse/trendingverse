// lib/article-generation-prompt.ts
// Single source of truth for the article generation prompt used across
// AI Writer, Trends, and the auto-publish cron. Every article generated
// using this prompt will satisfy the algorithmic SEO scorer by construction.

export interface ArticleSource {
  title: string        // original headline as published by the source
  url: string          // link to the original story
  publisher: string    // e.g. "The Hindu"
  description?: string // summary/lede from the feed
  publishedAt?: string // ISO date from the feed
}

export function buildArticlePrompt(params: {
  title: string
  category: string
  keywords: string[]
  language: string
  focusKeyword?: string
  region?: string
  source?: ArticleSource
}): string {
  const { title, category, keywords, language, focusKeyword, region = 'India', source } = params
  const kw = focusKeyword || keywords[0] || title.split(' ').slice(0, 3).join(' ')
  const categorySlug = category.toLowerCase().replace(/\s+/g, '-')

  // Region-specific persona and audience targeting
  const regionContext: Record<string, { persona: string; audience: string; wordCount: string }> = {
    'USA': {
      persona: 'senior American journalist for TrendingVerse, a global news platform',
      audience: 'US-based English-speaking readers',
      wordCount: '900-1100',
    },
    'GCC': {
      persona: 'senior journalist covering Gulf and Middle East affairs for TrendingVerse',
      audience: 'readers in the UAE, Saudi Arabia, Qatar, Kuwait, Bahrain and Oman',
      wordCount: '750-900',
    },
    'India': {
      persona: 'senior journalist for TrendingVerse, covering Indian and global affairs',
      audience: 'Indian English-speaking readers',
      wordCount: '750-900',
    },
  }
  const ctx = regionContext[region] || regionContext['India']

  // When a real source story is supplied, the article must be grounded in it.
  const sourceBlock = source
    ? `
SOURCE STORY (the ONLY basis for factual claims):
- Original headline: ${source.title}
- Publisher: ${source.publisher}
- Published: ${source.publishedAt || 'recently'}
- URL: ${source.url}
- Summary from the source: ${source.description || '(no summary provided — stick to what the headline states)'}

ACCURACY RULES — these override every SEO rule below:
- Report ONLY facts stated in the source headline/summary above. Do NOT invent names, quotes, numbers, dates, product names, launches, decisions or events.
- If a detail is not in the source, do not state it as fact. Add value with clearly-labelled background and context ("Background:", "What this means:") that is general and verifiably true, not new claims.
- Never write that something "has been announced", "launched" or "approved" unless the source says so.
- Attribute the core news to the publisher in the first or second paragraph, e.g. "according to ${source.publisher}".
- Include this exact source link once in the body: <a href="${source.url}" rel="nofollow noopener" target="_blank">${source.publisher}</a>
- Do not present the story as an exclusive or as TrendingVerse's own reporting.
`
    : `
ACCURACY RULES:
- Do NOT invent names, quotes, statistics, dates, product launches or events. Write only what is generally established and verifiable.
`

  return `You are a ${ctx.persona}.
Write a complete, original, accurate news article in ${language} for ${ctx.audience}.
${sourceBlock}
ARTICLE BRIEF:
- Title: ${title}
- Region/Audience: ${region}
- Category: ${category}
- Focus keyword: "${kw}"
- Related keywords: ${keywords.join(', ')}
- Language: ${language}

MANDATORY SEO REQUIREMENTS — the article MUST satisfy ALL of these:

1. WORD COUNT: Write ${ctx.wordCount} words of actual body content. Count carefully.

2. OPENING PARAGRAPH: The very first paragraph must naturally include the focus keyword "${kw}" within the first 3 sentences.

3. STRUCTURE — use this exact HTML structure:
   - One <h1> tag for the main title (containing the focus keyword)
   - At least 3 <h2> subheadings that break the article into clear sections
   - Body paragraphs in <p> tags
   - Use <strong> for the focus keyword on its first 2-3 appearances
   - At least one <ul> or <ol> list somewhere in the article

4. KEYWORD DENSITY: Use the focus keyword "${kw}" naturally 4-6 times throughout the article (0.5%-2% density). Do NOT stuff keywords — only use them where they read naturally.

5. LINKS: Include at least TWO internal links within the article body:
   - At least one link to the category page: <a href="https://trendingverse.online/${categorySlug}">${category} news on TrendingVerse</a>
   - One link to the TrendingVerse homepage: <a href="https://trendingverse.online">TrendingVerse</a>
   Both links should appear naturally in the text, not forced.

6. TONE: Professional journalistic tone. E-E-A-T compliant. Google Discover ready. AdSense safe. No AI spam patterns. No filler phrases like "In conclusion" or "It is worth noting".

7. IMAGE PLACEHOLDER: At the very start of the content (before the first paragraph), include this exact HTML:
   <figure><img src="" alt="${kw} - ${category} news" width="1200" height="675" /></figure>
   (The src will be filled in by the publish pipeline — do NOT omit this.)

8. AD SLOT: After the second <h2> subheading (roughly mid-article), insert this exact HTML on its own line:
   <!-- tv-ad-slot -->

9. NO AUTHOR LINE: Do not add any byline — the site template adds it automatically.

Return ONLY valid JSON, nothing else:
{
  "title": "Headline in ${language} containing focus keyword",
  "content": "Full HTML article — must start with the <figure> image placeholder, then <h1>, then body paragraphs with <h2> subheadings. Mid-article <!-- tv-ad-slot --> comment. No byline.",
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
