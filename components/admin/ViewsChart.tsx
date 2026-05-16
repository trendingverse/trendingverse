'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export function ViewsChart({ data }: { data: { date: string; views: number }[] }) {
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-sm text-ink-700 mb-4">Daily Views — Last 14 Days</h3>
      {data.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-ink-300 text-sm">No view data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ee" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8a8a92' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#8a8a92' }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #eeede9', borderRadius: 8, background: '#fff' }} cursor={{ fill: '#f7f7f5' }} />
            <Bar dataKey="views" fill="#e63946" radius={[4,4,0,0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
