// app/(admin)/admin/debug/page.tsx
// TEMPORARY — delete after fixing. Shows exact DB tables, columns & env status.

import { createClient as svcClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

async function run(svc: ReturnType<typeof svcClient>, sql: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await (svc as any).rpc('exec_sql', { sql }).select()
    if (r.error) return { error: r.error.message, data: null }
    return { data: r.data, error: null }
  } catch (e: unknown) {
    return { error: String(e), data: null }
  }
}

export default async function DebugPage() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? ''
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const keyAlt = process.env.SUPABASE_SERVICE_KEY    ?? ''

  const usedKey = key || keyAlt
  const svc = svcClient(url, usedKey || 'NO_KEY')

  // 1 — list all public tables
  const tables = await run(svc,
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
  )

  // 2 — Try reading partner_revenue directly (no RPC needed)
  const revCount = await svc.from('partner_revenue').select('*', { count: 'exact', head: true })
  const revSample = await svc.from('partner_revenue').select('*').limit(3)

  // 3 — Try ad_networks
  const netCount = await svc.from('ad_networks').select('*', { count: 'exact', head: true })
  const netSample = await svc.from('ad_networks').select('*').limit(3)

  // 4 — Try sites
  const siteCount = await svc.from('sites').select('*', { count: 'exact', head: true })

  // 5 — Try partner_mediation_events (another possible table)
  const medCount = await svc.from('mediation_events').select('*', { count: 'exact', head: true })

  // 6 — Try partners table
  const partCount = await svc.from('partners').select('*', { count: 'exact', head: true })
  const partSample = await svc.from('partners').select('*').limit(3)

  const row = (label: string, value: string, ok?: boolean) => (
    <tr style={{ borderBottom: '1px solid #1a2840' }}>
      <td style={{ padding: '8px 16px', color: '#6b82a8', fontFamily: 'monospace', fontSize: 13 }}>{label}</td>
      <td style={{ padding: '8px 16px', fontFamily: 'monospace', fontSize: 13,
        color: ok === true ? '#10b981' : ok === false ? '#ef4444' : '#dde4f0' }}>{value}</td>
    </tr>
  )

  const section = (title: string) => (
    <tr><td colSpan={2} style={{ padding: '16px 16px 4px', color: '#dc2626', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{title}</td></tr>
  )

  return (
    <div style={{ background: '#070c18', minHeight: '100vh', padding: 32, fontFamily: 'monospace' }}>
      <h1 style={{ color: '#dde4f0', fontSize: 20, marginBottom: 8 }}>🔍 TrendingVerse Debug</h1>
      <p style={{ color: '#6b82a8', fontSize: 13, marginBottom: 32 }}>
        This page shows your exact Supabase tables and env setup. <strong style={{color:'#ef4444'}}>Delete after fixing.</strong>
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#0e1726', borderRadius: 12, overflow: 'hidden', border: '1px solid #1a2840', marginBottom: 32 }}>
        <tbody>
          {section('Environment Variables')}
          {row('NEXT_PUBLIC_SUPABASE_URL',       url  ? url.slice(0,40)+'…' : '❌ NOT SET', !!url)}
          {row('SUPABASE_SERVICE_ROLE_KEY',      key  ? '✅ SET ('+key.length+' chars)' : '❌ NOT SET', !!key)}
          {row('SUPABASE_SERVICE_KEY (alt)',     keyAlt ? '✅ SET ('+keyAlt.length+' chars)' : '❌ NOT SET', !!keyAlt)}
          {row('Key being used',                 usedKey ? 'YES — '+usedKey.length+' chars' : '❌ NO KEY', !!usedKey)}

          {section('Table: partner_revenue')}
          {row('Table exists / count',
            revCount.error ? '❌ ERROR: '+revCount.error.message : '✅ '+revCount.count+' rows',
            !revCount.error)}
          {row('Sample columns (row 0)',
            revSample.data && revSample.data.length > 0
              ? Object.keys(revSample.data[0]).join(', ')
              : revSample.error ? '❌ '+revSample.error.message : '(no rows)',
            !revSample.error)}
          {revSample.data && revSample.data.length > 0 && row('Sample row',
            JSON.stringify(revSample.data[0]).slice(0, 200), undefined)}

          {section('Table: ad_networks')}
          {row('Table exists / count',
            netCount.error ? '❌ ERROR: '+netCount.error.message : '✅ '+netCount.count+' rows',
            !netCount.error)}
          {row('Sample columns (row 0)',
            netSample.data && netSample.data.length > 0
              ? Object.keys(netSample.data[0]).join(', ')
              : netSample.error ? '❌ '+netSample.error.message : '(no rows)',
            !netSample.error)}
          {netSample.data && netSample.data.length > 0 && row('Sample row',
            JSON.stringify(netSample.data[0]).slice(0, 200), undefined)}

          {section('Table: sites')}
          {row('Table exists / count',
            siteCount.error ? '❌ ERROR: '+siteCount.error.message : '✅ '+siteCount.count+' rows',
            !siteCount.error)}

          {section('Table: partners (alternate name?)')}
          {row('Table exists / count',
            partCount.error ? '❌ ERROR: '+partCount.error.message : '✅ '+partCount.count+' rows',
            !partCount.error)}
          {partSample.data && partSample.data.length > 0 && row('Sample columns',
            Object.keys(partSample.data[0]).join(', '), undefined)}

          {section('Table: mediation_events')}
          {row('Table exists / count',
            medCount.error ? '❌ ERROR: '+medCount.error.message : '✅ '+medCount.count+' rows',
            !medCount.error)}
        </tbody>
      </table>

      <p style={{ color: '#6b82a8', fontSize: 12 }}>
        Screenshot this page and share it. It will instantly show what is wrong.
      </p>
    </div>
  )
}
