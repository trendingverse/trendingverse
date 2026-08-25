'use client'
// app/(admin)/admin/_components/ChartWrapper.tsx
// Client component — the ONLY place where next/dynamic + ssr:false is allowed

import dynamic from 'next/dynamic'

function Skeleton() {
  return (
    <div
      className="animate-pulse rounded-lg"
      style={{ height: 200, background: '#131f33' }}
    />
  )
}

const _Revenue = dynamic(
  () => import('./DashboardCharts').then(m => ({ default: m.RevenueAreaChart })),
  { ssr: false, loading: () => <Skeleton /> }
)
const _Impressions = dynamic(
  () => import('./DashboardCharts').then(m => ({ default: m.ImpressionsBarChart })),
  { ssr: false, loading: () => <Skeleton /> }
)
const _Network = dynamic(
  () => import('./DashboardCharts').then(m => ({ default: m.NetworkBarChart })),
  { ssr: false, loading: () => <Skeleton /> }
)

export function RevenueChartWrapper(props: { data: { date: string; revenue: number }[] }) {
  return <_Revenue {...props} />
}
export function ImpressionsChartWrapper(props: { data: { date: string; impressions: number }[] }) {
  return <_Impressions {...props} />
}
export function NetworkChartWrapper(props: { data: { network: string; revenue: number }[] }) {
  return <_Network {...props} />
}
