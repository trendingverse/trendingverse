import type { Category } from '@/types'

export function CategoryBar({ categories }: { categories: Category[] }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-hide no-scrollbar">
        <a href="/" className="shrink-0 px-3 py-1 text-xs font-semibold text-white bg-accent rounded-full transition-colors">All</a>
        {categories.map(c => (
          <a key={c.slug} href={`/${c.slug}`}
            className="shrink-0 px-3 py-1 text-xs font-medium text-ink-600 hover:bg-ink-900 hover:text-white rounded-full transition-colors whitespace-nowrap">
            {c.name}
          </a>
        ))}
      </div>
    </div>
  )
}
