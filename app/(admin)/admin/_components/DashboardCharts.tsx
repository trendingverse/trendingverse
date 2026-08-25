'use client'

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'

/* ─── Types ──────────────────────────────────────────────────────── */
interface RevenueRow   { date: string; revenue: number; impressions: number }
interface NetworkRow   { network: string; revenue: number; impressions: number; cpm: number }
interface ViewsRow     { date: string; views: number }

/* ─── Revenue Area Chart ─────────────────────────────────────────── */
export function RevenueChart({ data }: { data: RevenueRow[] }) {
  if (!data.length) return <EmptyChart label="No revenue data yet" />
  const fmt = (v: number) => `$${v.toFixed(3)}`
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#dc2626" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#dc2626" stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={52} />
        <Tooltip
          formatter={(v: number) => [`$${v.toFixed(4)}`, 'Revenue']}
          contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#94a3b8' }}
          itemStyle={{ color: '#f87171' }}
        />
        <Area type="monotone" dataKey="revenue" stroke="#dc2626" strokeWidth={2} fill="url(#rev-grad)" dot={false} activeDot={{ r: 4, fill: '#dc2626' }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ─── Impressions Bar Chart ──────────────────────────────────────── */
export function ImpressionsChart({ data }: { data: RevenueRow[] }) {
  if (!data.length) return <EmptyChart label="No impression data yet" />
  const fmt = (v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v)
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={44} />
        <Tooltip
          formatter={(v: number) => [v.toLocaleString(), 'Impressions']}
          contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#94a3b8' }}
          itemStyle={{ color: '#60a5fa' }}
        />
        <Bar dataKey="impressions" fill="#1d4ed8" radius={[3, 3, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ─── Network Revenue Bar Chart ──────────────────────────────────── */
export function NetworkChart({ data }: { data: NetworkRow[] }) {
  if (!data.length) return <EmptyChart label="No network data yet" />
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
        <XAxis type="number" tickFormatter={(v) => `$${v.toFixed(3)}`} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="network" tick={{ fontSize: 12, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={80} />
        <Tooltip
          formatter={(v: number) => [`$${v.toFixed(4)}`, 'Revenue']}
          contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#94a3b8' }}
          itemStyle={{ color: '#4ade80' }}
        />
        <Bar dataKey="revenue" fill="#16a34a" radius={[0, 4, 4, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ─── Views Chart ─────────────────────────────────────────────────── */
export function ViewsChart({ data }: { data: ViewsRow[] }) {
  if (!data.length) return <EmptyChart label="No view data yet" />
  const fmt = (v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v)
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="views-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={36} />
        <Tooltip
          formatter={(v: number) => [v.toLocaleString(), 'Views']}
          contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#94a3b8' }}
          itemStyle={{ color: '#a78bfa' }}
        />
        <Area type="monotone" dataKey="views" stroke="#7c3aed" strokeWidth={2} fill="url(#views-grad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ─── Shared empty state ──────────────────────────────────────────── */
function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-slate-600 text-sm">
      {label}
    </div>
  )
}
