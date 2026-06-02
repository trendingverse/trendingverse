// Central plan configuration — single source of truth
export const PLANS = {
  free: {
    name: 'Free',
    articles_per_day: 5,
    sites: 1,
    platform_ai_keys: false,
    cron: false,
    gsc_ga4: false,
    ads: false,
    publisher_management: false,
    paste_enrich: true,
    seo_engine: true,
  },
  growth: {
    name: 'Growth',
    articles_per_day: 50,
    sites: 3,
    platform_ai_keys: false,
    cron: true,
    gsc_ga4: true,
    ads: true,
    publisher_management: false,
    paste_enrich: true,
    seo_engine: true,
  },
  pro: {
    name: 'Pro',
    articles_per_day: -1, // unlimited
    sites: -1,
    platform_ai_keys: true,
    cron: true,
    gsc_ga4: true,
    ads: true,
    publisher_management: true,
    paste_enrich: true,
    seo_engine: true,
  },
  byoak: {
    name: 'BYOAK',
    articles_per_day: -1,
    sites: -1,
    platform_ai_keys: false,
    cron: true,
    gsc_ga4: true,
    ads: true,
    publisher_management: true,
    paste_enrich: true,
    seo_engine: true,
  },
  agency: {
    name: 'Agency',
    articles_per_day: -1,
    sites: -1,
    platform_ai_keys: true,
    cron: true,
    gsc_ga4: true,
    ads: true,
    publisher_management: true,
    paste_enrich: true,
    seo_engine: true,
  },
} as const

export type PlanKey = keyof typeof PLANS

export function getPlanLimits(plan: string) {
  return PLANS[plan as PlanKey] || PLANS.free
}

export function canUseFeature(plan: string, feature: keyof typeof PLANS.free): boolean {
  const limits = getPlanLimits(plan)
  return !!limits[feature]
}
