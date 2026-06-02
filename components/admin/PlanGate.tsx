// components/admin/PlanGate.tsx
// Wrap any feature with this to enforce plan limits

'use client'
import Link from 'next/link'

interface PlanGateProps {
  children: React.ReactNode
  plan: string
  requiredPlans: string[]
  feature?: string
}

export function PlanGate({ children, plan, requiredPlans, feature }: PlanGateProps) {
  const hasAccess = requiredPlans.includes(plan)

  if (hasAccess) return <>{children}</>

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-40 select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl backdrop-blur-sm">
        <div className="text-center p-6 max-w-xs">
          <div className="text-3xl mb-2">🔒</div>
          <p className="font-semibold text-ink-900 text-sm mb-1">
            {feature ? `${feature} is locked` : 'Feature locked'}
          </p>
          <p className="text-xs text-ink-400 mb-4">
            Available on Growth plan and above
          </p>
          <Link href="/pricing"
            className="inline-block bg-red-500 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-red-600 transition-colors">
            Upgrade plan →
          </Link>
        </div>
      </div>
    </div>
  )
}

// Inline upgrade banner — use inside components
export function UpgradeBanner({ plan, feature, requiredPlan = 'Growth' }: { plan: string; feature: string; requiredPlan?: string }) {
  const plans = ['free', 'growth', 'pro', 'byoak', 'agency']
  const currentIdx = plans.indexOf(plan)
  const requiredIdx = plans.indexOf(requiredPlan.toLowerCase())

  if (currentIdx >= requiredIdx) return null

  return (
    <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-xl">
      <div className="flex items-center gap-2">
        <span className="text-amber-500">🔒</span>
        <span className="text-xs text-amber-800 font-medium">{feature} requires {requiredPlan} plan or higher</span>
      </div>
      <Link href="/pricing" className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 font-medium shrink-0">
        Upgrade →
      </Link>
    </div>
  )
}
