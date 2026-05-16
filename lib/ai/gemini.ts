import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

async function gen(prompt: string) { return (await model.generateContent(prompt)).response.text() }
function parseJSON<T>(text: string): T {
  const c = text.replace(/```json\n?|```/g,'').trim()
  const m = c.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  return JSON.parse(m?.[0]||c)
}

export async function generateArticle(opts: { title?:string; topic?:string; keywords?:string[]; category?:string; tone?:string; wordCount?:number }) {
  const text = await gen(`You are a senior journalist writing for TrendingVerse, a breaking news website.
Write a complete, original, SEO-optimized English news article.
Topic: ${opts.title||opts.topic}
Category: ${opts.category||'News'}
Keywords: ${(opts.keywords||[]).join(', ')}
Tone: ${opts.tone||'objective, journalistic'}
Target word count: ${opts.wordCount||700}
Return ONLY valid JSON (no markdown):
{"title":"headline max 80 chars","content":"Full HTML using only <p><h2><h3><strong><em><ul><li> tags. Min 600 words.","excerpt":"2-3 sentence summary","seo_title":"50-60 chars","meta_description":"150-160 chars","focus_keyword":"primary keyword","keywords":["k1","k2","k3","k4","k5"],"tags":["t1","t2","t3"],"reading_time":4}`)
  return parseJSON<{title:string;content:string;excerpt:string;seo_title:string;meta_description:string;focus_keyword:string;keywords:string[];tags:string[];reading_time:number}>(text)
}

export async function generateHeadlines(topic: string, count=5) {
  const text = await gen(`Generate ${count} Google Discover-optimized headlines for: "${topic}"
Rules: unique angles, 50-80 chars each, engaging CTR-bait.
Return ONLY JSON array of strings: ["h1","h2","h3"]`)
  return parseJSON<string[]>(text)
}

export async function enhanceSEO(article: { title:string; content:string; focus_keyword?:string }) {
  const text = await gen(`Analyze this article and generate SEO enhancements.
Title: ${article.title}
Keyword: ${article.focus_keyword||'not set'}
Content preview: ${article.content.replace(/<[^>]+>/g,'').slice(0,500)}
Return ONLY valid JSON:
{"seo_title":"50-60 chars","meta_description":"150-160 chars","focus_keyword":"best keyword","keywords":["k1","k2","k3","k4","k5","k6"],"discover_tips":["tip1","tip2"],"readability_suggestions":["s1","s2"]}`)
  return parseJSON<{seo_title:string;meta_description:string;focus_keyword:string;keywords:string[];discover_tips:string[];readability_suggestions:string[]}>(text)
}

export async function rewriteContent(content: string, instruction: string) {
  const plain = content.replace(/<[^>]+>/g,'').slice(0,2000)
  return await gen(`Rewrite this article content. Instruction: "${instruction}"
Original: ${plain}
Rules: return improved HTML using only <p><h2><h3><strong><em><ul><li> tags. Keep facts, improve engagement. Min 500 words.
Return ONLY the HTML, nothing else.`)
}

export async function detectTrending(region='Global') {
  const text = await gen(`List top 10 trending news topics RIGHT NOW for ${region}.
Return ONLY valid JSON array:
[{"title":"topic","summary":"1 sentence","category":"Technology","keywords":["k1","k2"]}]
Categories: Technology,Business,Politics,Science,Health,Sports,Entertainment,World`)
  return parseJSON<{title:string;summary:string;category:string;keywords:string[]}[]>(text)
}

// OpenAI fallback
export async function generateWithOpenAI(prompt: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set')
  const OpenAI = (await import('openai')).default
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4000,
  })
  return res.choices[0].message.content || ''
}
export async function generateSeoEnhancement(article: { title: string; content: string; focus_keyword?: string }) {
  const prompt = `Analyze this article and return SEO improvements as JSON:
Title: ${article.title}
Keyword: ${article.focus_keyword || 'not set'}
Content preview: ${article.content.replace(/<[^>]+>/g,'').slice(0,400)}

Return ONLY valid JSON:
{"seo_title":"","meta_description":"","focus_keyword":"","keywords":[],"discover_tips":[],"readability_suggestions":[],"internal_link_suggestions":[]}`
  const text = await generate(prompt)
  return parseJSON<{seo_title:string;meta_description:string;focus_keyword:string;keywords:string[];discover_tips:string[];readability_suggestions:string[];internal_link_suggestions:string[]}>(text)
}

export async function detectTrendingTopics(region = 'Global') {
  const prompt = `List 10 trending news topics right now for ${region}. Return ONLY a JSON array:
[{"title":"topic","summary":"1 sentence","category":"Technology","keywords":["kw1","kw2"]}]
Categories: Technology,Business,Politics,Science,Health,Sports,Entertainment,World`
  const text = await generate(prompt)
  return parseJSON<{title:string;summary:string;category:string;keywords:string[]}[]>(text)
}
