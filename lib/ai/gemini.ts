// Groq-backed AI helper (drop-in replacement for the old Gemini client)
// Uses llama-3.3-70b-versatile via Groq's OpenAI-compatible API

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

function parseJSON<T>(text: string): T {
  const clean = text.replace(/```json\n?|```/g, '').trim()
  const m = clean.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
  return JSON.parse(m?.[0] || clean)
}

async function groq(prompt: string, temperature = 0.7, maxTokens = 4096): Promise<string> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not set')
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq error: ${err}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

export async function generateArticle(opts: {
  title?: string; topic?: string; keywords?: string[]
  category?: string; tone?: string; wordCount?: number
}) {
  const prompt = `You are a senior journalist writing for TrendingVerse (trendingverse.online).
Write a complete, original, SEO-optimized English news article.
Topic/Title: ${opts.title || opts.topic}
Category: ${opts.category || 'News'}
Keywords: ${(opts.keywords || []).join(', ')}
Tone: ${opts.tone || 'objective, journalistic'}
Target word count: ${opts.wordCount || 700}
Return ONLY valid JSON (no markdown, no backticks):
{"title":"Compelling headline max 80 chars","content":"Full article as HTML using only <p><h2><h3><strong><em><ul><li> tags. Min 600 words.","excerpt":"2-3 sentence summary","seo_title":"SEO title 50-60 chars","meta_description":"Meta description 150-160 chars","focus_keyword":"primary keyword","keywords":["kw1","kw2","kw3","kw4","kw5"],"tags":["tag1","tag2","tag3"],"reading_time":4}`
  const text = await groq(prompt, 0.7, 4096)
  return parseJSON<{ title: string; content: string; excerpt: string; seo_title: string; meta_description: string; focus_keyword: string; keywords: string[]; tags: string[]; reading_time: number }>(text)
}

export async function generateHeadlines(topic: string, count = 5) {
  const prompt = `Generate ${count} compelling, Google Discover-optimized headlines for this news topic: "${topic}"
Rules: Each headline must be unique and engaging. Mix different angles. 50-80 characters each.
Return ONLY a JSON array of strings: ["headline1", "headline2"]`
  const text = await groq(prompt, 0.8, 512)
  return parseJSON<string[]>(text)
}

export async function generateSeoEnhancement(article: { title: string; content: string; focus_keyword?: string }) {
  const prompt = `Analyze this article and return SEO improvements.
Title: ${article.title}
Keyword: ${article.focus_keyword || 'not set'}
Content: ${article.content.replace(/<[^>]+>/g, '').slice(0, 400)}
Return ONLY valid JSON:
{"seo_title":"","meta_description":"","focus_keyword":"","keywords":[],"discover_tips":[],"readability_suggestions":[],"internal_link_suggestions":[]}`
  const text = await groq(prompt, 0.3, 1024)
  return parseJSON<{ seo_title: string; meta_description: string; focus_keyword: string; keywords: string[]; discover_tips: string[]; readability_suggestions: string[]; internal_link_suggestions: string[] }>(text)
}

export async function rewriteContent(content: string, instruction: string) {
  const plain = content.replace(/<[^>]+>/g, '').slice(0, 2000)
  const prompt = `Rewrite this news article. Instruction: "${instruction}"
Original: ${plain}
Rules: Return improved HTML using only <p><h2><h3><strong><em><ul><li> tags. Keep key facts. Min 500 words.
Return ONLY the HTML content.`
  return groq(prompt, 0.7, 3000)
}

export async function generateMetaDescription(title: string, excerpt: string, keyword: string) {
  const prompt = `Write a Google SEO meta description.
Title: ${title}
Excerpt: ${excerpt}
Focus keyword: ${keyword}
Rules: 150-160 characters, include keyword, compelling CTA. Return ONLY the description text.`
  const text = await groq(prompt, 0.3, 200)
  return text.trim()
}

export async function detectTrendingTopics(region = 'Global') {
  const prompt = `List 10 trending news topics right now for ${region}.
Return ONLY a valid JSON array, nothing else before or after it:
[{"title":"topic title","summary":"one sentence summary","category":"Technology","keywords":["kw1","kw2"]}]
Categories must be one of: Technology, Business, Politics, Science, Health, Sports, Entertainment, World`
  try {
    const text = await groq(prompt, 0.7, 1024)
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON array found in response')
    return JSON.parse(match[0])
  } catch (e) {
    console.error('detectTrendingTopics error:', e)
    return []
  }
}

export async function suggestRelatedArticles(title: string, keywords: string[], allTitles: string[]) {
  const prompt = `Given article: "${title}" with keywords: ${keywords.join(', ')}
From this list, pick the 3 most related:
${allTitles.slice(0, 30).map((t, i) => `${i}: ${t}`).join('\n')}
Return ONLY a JSON array of index numbers: [0, 5, 12]`
  const text = await groq(prompt, 0.3, 64)
  const indices = parseJSON<number[]>(text)
  return indices.map(i => allTitles[i]).filter(Boolean)
}
