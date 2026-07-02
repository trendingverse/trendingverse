// lib/seo-scorer.ts
// Deterministic, algorithmic SEO scorer — zero AI calls, zero cost.
// Every factor is computed from the actual content, not estimated.
// All publish paths (AI Writer, Paste & Enrich, Trends, Cron) call
// this same function so scores are consistent and improvable.

export interface SeoFactor {
  label: string
  description: string
  points: number
  earned: number
  passed: boolean
  value?: string | number // the actual measured value
}

export interface SeoScoreResult {
  total: number          // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  factors: SeoFactor[]
  tips: string[]         // actionable fixes for any failed factor
}

// ── Helpers ────────────────────────────────────────────────────
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function getHeadings(html: string, tag: 'h1' | 'h2' | 'h3'): string[] {
  const matches = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi')) || []
  return matches.map(h => stripHtml(h))
}

function keywordDensity(text: string, keyword: string): number {
  if (!keyword || !text) return 0
  const words = text.toLowerCase().split(/\s+/).filter(Boolean)
  const kw = keyword.toLowerCase()
  const matches = words.filter(w => w.includes(kw)).length
  return words.length > 0 ? (matches / words.length) * 100 : 0
}

function keywordInFirstNWords(text: string, keyword: string, n = 100): boolean {
  if (!keyword) return false
  const first = text.split(/\s+/).slice(0, n).join(' ').toLowerCase()
  return first.includes(keyword.toLowerCase())
}

function hasImage(html: string): boolean {
  return /<img[^>]+>/i.test(html)
}

function imageHasAlt(html: string, keyword = ''): boolean {
  const imgMatches = html.match(/<img[^>]+>/gi) || []
  if (!imgMatches.length) return false
  return imgMatches.some(img => {
    const altMatch = img.match(/alt=["']([^"']*)["']/i)
    if (!altMatch) return false
    const alt = altMatch[1].trim()
    if (!alt) return false
    if (keyword) return alt.toLowerCase().includes(keyword.toLowerCase())
    return alt.length > 0
  })
}

function hasInternalLinks(html: string): boolean {
  return /<a[^>]+href[^>]*>/i.test(html)
}

// ── Main scorer ────────────────────────────────────────────────
export function computeSeoScore(params: {
  title: string
  content: string          // raw HTML content
  metaDescription: string
  focusKeyword: string
  excerpt?: string
}): SeoScoreResult {
  const { title, content, metaDescription, focusKeyword, excerpt } = params
  const plainContent = stripHtml(content)
  const wordCount = countWords(plainContent)
  const h2s = getHeadings(content, 'h2')
  const density = keywordDensity(plainContent, focusKeyword)
  const kwInFirst100 = keywordInFirstNWords(plainContent, focusKeyword, 100)
  const titleHasKw = focusKeyword
    ? title.toLowerCase().includes(focusKeyword.toLowerCase())
    : false
  const metaLen = metaDescription.length
  const excerptLen = (excerpt || '').replace(/<[^>]+>/g, '').trim().length

  const factors: SeoFactor[] = [
    // ── Word count (20 pts) ─────────────────────────────────
    {
      label: 'Word Count',
      description: 'Articles with 700+ words rank significantly better in search and Discover.',
      points: 20,
      earned: wordCount >= 700 ? 20 : wordCount >= 500 ? 14 : wordCount >= 350 ? 8 : 0,
      passed: wordCount >= 700,
      value: `${wordCount} words`,
    },
    // ── Focus keyword in title (15 pts) ─────────────────────
    {
      label: 'Keyword in Title',
      description: 'The focus keyword (or a close variant) must appear in the article title.',
      points: 15,
      earned: titleHasKw ? 15 : 0,
      passed: titleHasKw,
      value: focusKeyword || '—',
    },
    // ── Keyword in first 100 words (15 pts) ─────────────────
    {
      label: 'Keyword in Opening',
      description: 'The focus keyword should appear within the first 100 words to signal topic relevance.',
      points: 15,
      earned: kwInFirst100 ? 15 : 0,
      passed: kwInFirst100,
      value: kwInFirst100 ? 'Found in opening' : 'Not found in first 100 words',
    },
    // ── Meta description length (10 pts) ────────────────────
    {
      label: 'Meta Description',
      description: 'Meta description should be 150-160 characters — long enough to be descriptive, short enough not to be truncated.',
      points: 10,
      earned: metaLen >= 150 && metaLen <= 160 ? 10 : metaLen >= 120 && metaLen <= 170 ? 6 : metaLen > 0 ? 3 : 0,
      passed: metaLen >= 150 && metaLen <= 160,
      value: `${metaLen} characters`,
    },
    // ── H2 subheadings (10 pts) ─────────────────────────────
    {
      label: 'Subheadings (H2)',
      description: 'At least 2 H2 subheadings improve scannability and help Google understand content structure.',
      points: 10,
      earned: h2s.length >= 3 ? 10 : h2s.length >= 2 ? 8 : h2s.length === 1 ? 4 : 0,
      passed: h2s.length >= 2,
      value: `${h2s.length} H2 subheadings`,
    },
    // ── Keyword density (10 pts) ─────────────────────────────
    {
      label: 'Keyword Density',
      description: 'Focus keyword should appear 0.5%–2.5% of total words — enough to be relevant, not enough to be spammy.',
      points: 10,
      earned: density >= 0.5 && density <= 2.5 ? 10 : density > 0 && density < 4 ? 5 : 0,
      passed: density >= 0.5 && density <= 2.5,
      value: `${density.toFixed(2)}%`,
    },
    // ── Image with alt text (10 pts) ────────────────────────
    {
      label: 'Image with Alt Text',
      description: 'Featured or inline image with descriptive alt text helps with image search and accessibility.',
      points: 10,
      earned: imageHasAlt(content, focusKeyword) ? 10 : hasImage(content) ? 5 : 0,
      passed: imageHasAlt(content, focusKeyword),
      value: hasImage(content) ? (imageHasAlt(content) ? 'Image + alt text present' : 'Image present, alt text missing') : 'No image found',
    },
    // ── Excerpt (5 pts) ──────────────────────────────────────
    {
      label: 'Excerpt / Summary',
      description: 'A concise excerpt (50+ characters) is used by WordPress and Google as the article summary.',
      points: 5,
      earned: excerptLen >= 80 ? 5 : excerptLen >= 50 ? 3 : 0,
      passed: excerptLen >= 50,
      value: `${excerptLen} characters`,
    },
    // ── Internal/external links (5 pts) ─────────────────────
    {
      label: 'Links in Content',
      description: 'At least one link (internal or external) signals a well-researched article and improves crawlability.',
      points: 5,
      earned: hasInternalLinks(content) ? 5 : 0,
      passed: hasInternalLinks(content),
      value: hasInternalLinks(content) ? 'Links present' : 'No links found',
    },
  ]

  const total = factors.reduce((sum, f) => sum + f.earned, 0)
  const grade: SeoScoreResult['grade'] =
    total >= 90 ? 'A' : total >= 75 ? 'B' : total >= 60 ? 'C' : total >= 45 ? 'D' : 'F'

  const tips = factors
    .filter(f => !f.passed)
    .map(f => {
      switch (f.label) {
        case 'Word Count': return `Add more detail — article needs ${700 - wordCount}+ more words to reach the 700-word minimum.`
        case 'Keyword in Title': return `Add "${focusKeyword}" to the article title.`
        case 'Keyword in Opening': return `Mention "${focusKeyword}" within the first paragraph.`
        case 'Meta Description': return metaLen === 0
          ? 'Write a meta description (150-160 characters).'
          : metaLen < 150
          ? `Meta description is too short (${metaLen} chars). Expand to 150-160 characters.`
          : `Meta description is too long (${metaLen} chars). Trim to under 160 characters.`
        case 'Subheadings (H2)': return `Add at least ${2 - h2s.length} more H2 subheading${2 - h2s.length > 1 ? 's' : ''} to structure the article.`
        case 'Keyword Density': return density < 0.5
          ? `Use "${focusKeyword}" more naturally — current density is only ${density.toFixed(2)}%.`
          : `Reduce keyword usage — density of ${density.toFixed(2)}% may look spammy to Google.`
        case 'Image with Alt Text': return hasImage(content)
          ? `Add alt text to your image containing "${focusKeyword}".`
          : 'Add a featured image with descriptive alt text.'
        case 'Excerpt / Summary': return 'Write a concise excerpt of 50+ characters summarizing the article.'
        case 'Links in Content': return 'Add at least one link to a related article or authoritative source.'
        default: return `Improve: ${f.label}`
      }
    })

  return { total, grade, factors, tips }
}

// ── Grade metadata for UI ──────────────────────────────────────
export function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'text-green-600'
    case 'B': return 'text-blue-600'
    case 'C': return 'text-amber-600'
    case 'D': return 'text-orange-600'
    default:  return 'text-red-600'
  }
}

export function scoreBgColor(total: number): string {
  if (total >= 90) return 'bg-green-50 border-green-200'
  if (total >= 75) return 'bg-blue-50 border-blue-200'
  if (total >= 60) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}
