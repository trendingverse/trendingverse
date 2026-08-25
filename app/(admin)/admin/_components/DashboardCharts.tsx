'use client'

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts'

const TOOLTIP_STYLE = {
  background: '#0e1726',
  border: '1px solid #1a2840',
  borderRadius: 8,
  fontSize: 12,
  color: '#94a3b8',
}

export function RevenueAreaChart({ data }: { data: { date: string; revenue: number }[] }) {
  if (!data.length) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="rv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#e63030" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#e63030" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke="#0f1f35" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#3d5070' }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={v => `$${v.toFixed(3)}`} tick={{ fontSize: 10, fill: '#3d5070' }} tickLine={false} axisLine={false} width={54} />
        <Tooltip
          formatter={(v: number) => [`$${v.toFixed(4)}`, 'Revenue']}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: '#6b82a8' }}
          itemStyle={{ color: '#f87171' }}
          cursor={{ stroke: '#1a2840' }}
        />
        <Area type="monotone" dataKey="revenue" stroke="#e63030" strokeWidth={1.5} fill="url(#rv)" dot={false} activeDot={{ r: 3, fill: '#e63030', strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function ImpressionsBarChart({ data }: { data: { date: string; impressions: number }[] }) {
  if (!data.length) return <Empty />
  const fmt = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="#0f1f35" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#3d5070' }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: '#3d5070' }} tickLine={false} axisLine={false} width={40} />
        <Tooltip
          formatter={(v: number) => [v.toLocaleString(), 'Impressions']}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: '#6b82a8' }}
          itemStyle={{ color: '#60a5fa' }}
          cursor={{ fill: '#0f1f35' }}
        />
        <Bar dataKey="impressions" fill="#1d4ed8" radius={[2, 2, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function NetworkBarChart({ data }: { data: { network: string; revenue: number }[] }) {
  if (!data.length) return <Empty />
  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * 44, 120)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
        <XAxis type="number" tickFormatter={v => `$${v.toFixed(3)}`} tick={{ fontSize: 10, fill: '#3d5070' }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="network" tick={{ fontSize: 12, fill: '#6b82a8' }} tickLine={false} axisLine={false} width={90} />
        <Tooltip
          formatter={(v: number) => [`$${v.toFixed(4)}`, 'Revenue']}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: '#6b82a8' }}
          itemStyle={{ color: '#4ade80' }}
          cursor={{ fill: '#0f1f35' }}
        />
        <Bar dataKey="revenue" fill="#10b981" radius={[0, 3, 3, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function Empty() {
  return (
    <div className="h-32 flex items-center justify-center text-[#1a2840] text-sm font-mono">
      No data yet
    </div>
  )
}
