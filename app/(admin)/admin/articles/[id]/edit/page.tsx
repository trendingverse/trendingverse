/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { ArticleEditor } from '@/components/admin/ArticleEditor'
import { notFound } from 'next/navigation'

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: article }, { data: categories }, { data: tags }] = await Promise.all([
    supabase.from('articles').select('*, article_tags(tag_id)').eq('id', id).single(),
    supabase.from('categories').select('*').order('name'),
    supabase.from('tags').select('*').order('name'),
  ])
  
  if (!article) notFound()
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink-950">Edit Article</h1>
        <p className="text-sm text-ink-400 font-mono">/article/{article.slug}</p>
      </div>
      <ArticleEditor
        article={article as any}
        categories={(categories || []) as any}
        tags={(tags || []) as any}
      />
    </div>
  )
}
