// components/admin/SeoScoreCard.tsx
'use client'
import { SeoScoreResult, gradeColor, scoreBgColor } from '@/lib/seo-scorer'

export function SeoScoreCard({ score }: { score: SeoScoreResult }) {
  const ringColor = score.total >= 90 ? '#16a34a' : score.total >= 75 ? '#2563eb' : score.total >= 60 ? '#d97706' : '#dc2626'
  const circumference = 2 * Math.PI * 36

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-ink-900">SEO Score</h3>
          <p className="text-xs text-ink-400 mt-0.5">Algorithmic · based on actual content analysis</p>
        </div>
        {/* Circular score ring */}
        <div className="relative w-20 h-20 shrink-0">
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
            <circle cx="40" cy="40" r="36" fill="none" stroke="#e5e7eb" strokeWidth="6" />
            <circle cx="40" cy="40" r="36" fill="none" stroke={ringColor} strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - score.total / 100)}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-ink-900">{score.total}</span>
            <span className={`text-xs font-bold ${gradeColor(score.grade)}`}>{score.grade}</span>
          </div>
        </div>
      </div>

      {/* Factor breakdown */}
      <div className="space-y-1.5">
        {score.factors.map((factor, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${factor.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {factor.passed ? '✓' : '✗'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-ink-800 truncate">{factor.label}</span>
                <span className="text-[10px] font-mono text-ink-400 shrink-0">
                  {factor.earned}/{factor.points}
                </span>
              </div>
              {factor.value && (
                <span className="text-[10px] text-ink-400">{factor.value}</span>
              )}
            </div>
            {/* Points bar */}
            <div className="w-16 h-1.5 bg-ink-100 rounded-full overflow-hidden shrink-0">
              <div
                className={`h-full rounded-full ${factor.passed ? 'bg-green-500' : factor.earned > 0 ? 'bg-amber-400' : 'bg-red-300'}`}
                style={{ width: `${(factor.earned / factor.points) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Actionable tips */}
      {score.tips.length > 0 && (
        <div className="pt-3 border-t border-ink-100">
          <p className="text-xs font-semibold text-ink-700 mb-2">⚡ What to fix:</p>
          <div className="space-y-1.5">
            {score.tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-ink-600">
                <span className="text-amber-500 shrink-0 mt-0.5">→</span>
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {score.total >= 90 && (
        <div className="pt-2 border-t border-green-100 bg-green-50 -mx-5 -mb-5 px-5 pb-5 rounded-b-xl">
          <p className="text-xs text-green-700 font-medium">✓ Excellent SEO — this article is ready for Google Discover</p>
        </div>
      )}
    </div>
  )
}
