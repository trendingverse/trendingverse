// app/(admin)/admin/outreach/page.tsx
import Link from 'next/link'

export default function OutreachPage() {
  const C = { s:'#0e1726', b:'#1a2840', t:'#dde4f0', m:'#6b82a8', d:'#2d3f58', e:'#131f33', bd:'#111e30' }

  const actions = [
    {
      icon: '📧',
      title: 'Email Campaigns',
      desc: 'Send onboarding emails to new publishers and advertisers.',
      link: 'mailto:',
      cta: 'Compose',
    },
    {
      icon: '💬',
      title: 'WhatsApp Outreach',
      desc: 'Reach publishers on WhatsApp with support and updates.',
      link: 'https://wa.me/',
      cta: 'Open',
    },
    {
      icon: '📢',
      title: 'Direct Campaigns',
      desc: 'Manage direct ad campaigns with advertisers.',
      link: '/admin/monetization',
      cta: 'Manage →',
    },
    {
      icon: '📡',
      title: 'Ad Networks',
      desc: 'Connect and manage programmatic ad network partners.',
      link: '/admin/monetization/ad-networks',
      cta: 'Manage →',
    },
  ]

  const publisherSignupUrl = 'https://trendingverse.vercel.app/'

  return (
    <div className="space-y-6 pb-8" style={{ color: C.t }}>

      {/* Header */}
      <div className="pt-1">
        <h1 className="text-2xl font-bold text-white">Outreach</h1>
        <p className="text-[13px] mt-1" style={{ color: C.m }}>
          Grow your publisher and advertiser network
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Publisher Sites',   val: '4', color: 'text-sky-400' },
          { label: 'Ad Networks',       val: '1', color: 'text-emerald-400' },
          { label: 'Direct Campaigns',  val: '—', color: 'text-violet-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-5" style={{ background: C.s, border: `1px solid ${C.b}` }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: C.d }}>{s.label}</p>
            <p className={`text-[28px] font-mono font-bold leading-none ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Action channels */}
      <div className="rounded-xl overflow-hidden" style={{ background: C.s, border: `1px solid ${C.b}` }}>
        <div className="px-6 py-4" style={{ borderBottom: `1px solid ${C.b}` }}>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: C.d }}>Outreach Channels</h2>
        </div>
        <div>
          {actions.map((a, i) => (
            <div key={a.title}
              className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors"
              style={{ borderBottom: i < actions.length - 1 ? `1px solid ${C.bd}` : undefined }}>
              <span className="text-2xl flex-shrink-0">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold" style={{ color: C.t }}>{a.title}</p>
                <p className="text-[12px] mt-0.5" style={{ color: C.m }}>{a.desc}</p>
              </div>
              <Link href={a.link}
                className="flex-shrink-0 px-4 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-colors hover:opacity-90"
                style={{ background: '#dc2626' }}>
                {a.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Publisher signup link — static display, no clipboard JS needed */}
      <div className="rounded-xl p-6" style={{ background: C.s, border: `1px solid ${C.b}` }}>
        <h2 className="text-[13px] font-semibold mb-1" style={{ color: C.t }}>Publisher Signup Link</h2>
        <p className="text-[12px] mb-3" style={{ color: C.m }}>Share this link to onboard publishers:</p>
        <div className="flex items-center gap-3 p-3 rounded-lg font-mono text-[12px]"
          style={{ background: C.e, border: `1px solid ${C.b}` }}>
          <span className="flex-1 truncate" style={{ color: C.t }}>{publisherSignupUrl}</span>
          <Link href={publisherSignupUrl} target="_blank" rel="noopener noreferrer"
            className="flex-shrink-0 px-3 py-1 rounded text-[11px] font-semibold text-white"
            style={{ background: '#dc2626' }}>
            Open ↗
          </Link>
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-xl p-6 text-center" style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)', border: `1px solid ${C.b}` }}>
        <p className="text-[20px] font-bold text-white mb-2">Onboard a new publisher?</p>
        <p className="text-[13px] mb-4" style={{ color: C.m }}>
          Add their site and configure ad tags from the Monetization section.
        </p>
        <Link href="/admin/monetization"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-white text-[13px] hover:opacity-90"
          style={{ background: '#dc2626' }}>
          Go to Monetization →
        </Link>
      </div>
    </div>
  )
}
