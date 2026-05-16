'use client'
interface Props { position: string; className?: string }
export function AdSlot({ position, className='' }: Props) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT
  const slots: Record<string,string|undefined> = {
    header: process.env.NEXT_PUBLIC_ADSENSE_HEADER_SLOT,
    inline: process.env.NEXT_PUBLIC_ADSENSE_INLINE_SLOT,
    sidebar: process.env.NEXT_PUBLIC_ADSENSE_SIDEBAR_SLOT,
    footer: process.env.NEXT_PUBLIC_ADSENSE_HEADER_SLOT,
  }
  const sizes: Record<string,{w:string;h:string;label:string}> = {
    header: {w:'728px',h:'90px',label:'728×90 Leaderboard'},
    inline: {w:'336px',h:'280px',label:'336×280 Rectangle'},
    sidebar: {w:'300px',h:'250px',label:'300×250 Medium Rectangle'},
    footer: {w:'728px',h:'90px',label:'728×90 Footer'},
  }
  const size = sizes[position] || sizes.header
  if (client && slots[position]) {
    return (
      <div className={`flex justify-center ${className}`}>
        <ins className="adsbygoogle" style={{display:'block',width:size.w,height:size.h}}
          data-ad-client={client} data-ad-slot={slots[position]} data-ad-format="auto" data-full-width-responsive="true" />
      </div>
    )
  }
  return (
    <div className={`flex justify-center ${className}`}>
      <div className="ad-slot" style={{width:size.w,height:size.h,maxWidth:'100%'}}>{size.label} · Advertisement</div>
    </div>
  )
}
