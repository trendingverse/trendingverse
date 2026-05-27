// lib/ads/injectAds.ts
// Helper to inject ad units into article HTML before pushing to WordPress

interface AdUnit {
  id: string
  ad_type: 'gam' | 'direct'
  position: string
  ad_code: string
  gam_network_code?: string
  gam_unit_path?: string
  size_width: number
  size_height: number
}

interface PublisherAd {
  ad_units: AdUnit
  inject_after_paragraph: number
  is_enabled: boolean
}

export function buildAdHtml(unit: AdUnit): string {
  if (unit.ad_type === 'gam' && unit.gam_network_code && unit.gam_unit_path) {
    const divId = `gpt-ad-${unit.id.slice(0, 8)}`
    return `
<div id="${divId}" style="text-align:center;margin:20px auto;">
<script>
googletag.cmd.push(function() {
  googletag.defineSlot('${unit.gam_unit_path}', [${unit.size_width}, ${unit.size_height}], '${divId}').addService(googletag.pubads());
  googletag.pubads().enableSingleRequest();
  googletag.enableServices();
  googletag.display('${divId}');
});
</script>
</div>`
  }
  // Direct ad code
  return `<div style="text-align:center;margin:20px auto;clear:both;">${unit.ad_code}</div>`
}

export function injectAdsIntoContent(content: string, publisherAds: PublisherAd[]): string {
  if (!publisherAds.length) return content

  // Split content into paragraphs
  const paragraphs = content.split('</p>')

  const inContentAds = publisherAds.filter(a =>
    a.is_enabled && a.ad_units?.position === 'in_content'
  )

  if (!inContentAds.length) return content

  // Sort by inject_after_paragraph
  inContentAds.sort((a, b) => a.inject_after_paragraph - b.inject_after_paragraph)

  const result: string[] = []
  for (let i = 0; i < paragraphs.length; i++) {
    result.push(paragraphs[i])
    if (paragraphs[i].trim()) result.push('</p>')

    // Check if any ad should be injected after this paragraph
    for (const pa of inContentAds) {
      if (i + 1 === pa.inject_after_paragraph) {
        result.push(buildAdHtml(pa.ad_units))
      }
    }
  }

  return result.join('')
}

export function buildHeaderFooterAds(publisherAds: PublisherAd[]): { header: string; footer: string } {
  const headerAds = publisherAds
    .filter(a => a.is_enabled && a.ad_units?.position === 'header')
    .map(a => buildAdHtml(a.ad_units)).join('\n')

  const footerAds = publisherAds
    .filter(a => a.is_enabled && a.ad_units?.position === 'footer')
    .map(a => buildAdHtml(a.ad_units)).join('\n')

  return { header: headerAds, footer: footerAds }
}
