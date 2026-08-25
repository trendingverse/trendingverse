// app/(admin)/admin/debug/page.tsx
// TEMPORARY diagnostic page — delete after fixing

import { createClient as svcClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export default async function DebugPage() {
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL    ?? ''
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY   ?? ''
  const altKey = process.env.SUPABASE_SERVICE_KEY        ?? ''
  const usedKey = svcKey || altKey

  const svc = svcClient(url, usedKey || 'NO_KEY_SET')

  // Direct table queries — no RPC, no type issues
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [
    revCount, revSample,
    netCount, netSample,
    siteCount, siteSample,
    partCount, partSample,
    medCount,
  ] = await Promise.all([
    svc.from('partner_revenue').select('*', { count: 'exact', head: true }),
    svc.from('partner_revenue').select('*').limit(2).order('id', { ascending: false }),
    svc.from('ad_networks').select('*', { count: 'exact', head: true }),
    svc.from('ad_networks').select('*').limit(2),
    svc.from('sites').select('*', { count: 'exact', head: true }),
    svc.from('sites').select('*').limit(2),
    svc.from('partners').select('*', { count: 'exact', head: true }),
    svc.from('partners').select('*').limit(2),
    svc.from('mediation_events').select('*', { count: 'exact', head: true }),
  ])

  const s = { background:'#0e1726', border:'1px solid #1a2840', borderRadius:8, padding:'16px', marginBottom:16 } as const
  const code = { fontFamily:'monospace', fontSize:12, background:'#131f33', padding:'8px 12px', borderRadius:6, display:'block', marginTop:8, wordBreak:'break-all' as const, color:'#dde4f0' }
  const ok  = { color: '#10b981' }
  const err = { color: '#ef4444' }
  const dim = { color: '#6b82a8', fontSize:12 }

  function tableInfo(label: string, countRes: any, sampleRes: any) {
    const hasErr   = !!countRes?.error
    const count    = countRes?.count ?? 0
    const cols     = sampleRes?.data?.[0] ? Object.keys(sampleRes.data[0]) : []
    const sample   = sampleRes?.data?.[0]

    return (
      <div style={s}>
        <p style={{ fontWeight:700, marginBottom:8, color:'#dde4f0' }}>{label}</p>
        {hasErr ? (
          <p style={err}>❌ Error: {countRes.error?.message} (code: {countRes.error?.code})</p>
        ) : (
          <>
            <p style={ok}>✅ Table exists — <strong>{count}</strong> rows</p>
            {cols.length > 0 && (
              <>
                <p style={{...dim, marginTop:8}}>Columns:</p>
                <code style={code}>{cols.join(', ')}</code>
              </>
            )}
            {sample && (
              <>
                <p style={{...dim, marginTop:8}}>Sample row:</p>
                <code style={code}>{JSON.stringify(sample, null, 2).slice(0, 500)}</code>
              </>
            )}
            {!sample && count === 0 && <p style={dim}>Table is empty</p>}
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ background:'#070c18', minHeight:'100vh', padding:32, fontFamily:'system-ui', color:'#dde4f0' }}>
      <h1 style={{ fontSize:22, marginBottom:4 }}>🔍 TrendingVerse Debug</h1>
      <p style={{ color:'#ef4444', fontSize:13, marginBottom:32 }}>
        ⚠️ TEMPORARY — Screenshot this page then delete <code>app/(admin)/admin/debug/page.tsx</code>
      </p>

      {/* Env vars */}
      <div style={s}>
        <p style={{ fontWeight:700, marginBottom:12, color:'#dde4f0' }}>Environment Variables</p>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <tbody>
            {[
              ['NEXT_PUBLIC_SUPABASE_URL',    url     ? url.slice(0,50)+'…' : '❌ NOT SET',           !!url],
              ['SUPABASE_SERVICE_ROLE_KEY',   svcKey  ? `✅ SET (${svcKey.length} chars)`  : '❌ NOT SET', !!svcKey],
              ['SUPABASE_SERVICE_KEY (alt)',  altKey  ? `✅ SET (${altKey.length} chars)`   : '❌ NOT SET', !!altKey],
              ['Active key being used',       usedKey ? `✅ YES — ${usedKey.length} chars`  : '❌ NO KEY — this is why revenue fails!', !!usedKey],
            ].map(([k, v, good]) => (
              <tr key={String(k)} style={{ borderBottom:'1px solid #1a2840' }}>
                <td style={{ padding:'8px 0', color:'#6b82a8', width:'50%' }}>{k}</td>
                <td style={{ padding:'8px 0', color: good ? '#10b981' : '#ef4444' }}>{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tableInfo('Table: partner_revenue', revCount, revSample)}
      {tableInfo('Table: ad_networks',     netCount, netSample)}
      {tableInfo('Table: sites',           siteCount, siteSample)}
      {tableInfo('Table: partners (alt name?)', partCount, partSample)}
      {tableInfo('Table: mediation_events',    medCount,  { data: null })}

      <p style={{ color:'#6b82a8', fontSize:12, marginTop:16 }}>
        Screenshot this and share → will instantly show the exact problem.
      </p>
    </div>
  )
}
