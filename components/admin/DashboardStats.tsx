interface Props { stats: { total_articles:number; published_articles:number; draft_articles:number; views_today:number; views_week:number; total_subscribers:number } }
export function DashboardStats({ stats }: Props) {
  const cards = [
    {label:'Total Articles',value:stats.total_articles,sub:`${stats.published_articles} published`,color:'text-accent'},
    {label:'Drafts',value:stats.draft_articles,sub:'In progress',color:'text-amber-500'},
    {label:"Today's Views",value:stats.views_today,sub:'Unique visits',color:'text-emerald-600'},
    {label:'Weekly Views',value:stats.views_week,sub:'Last 7 days',color:'text-blue-600'},
    {label:'Subscribers',value:stats.total_subscribers,sub:'Newsletter',color:'text-violet-600'},
    {label:'Publish Rate',value:`${stats.total_articles?Math.round(stats.published_articles/stats.total_articles*100):0}%`,sub:'Published',color:'text-ink-700'},
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map(c => (
        <div key={c.label} className="card p-4">
          <p className="text-xs text-ink-400 mb-1">{c.label}</p>
          <p className={`text-2xl font-bold ${c.color}`}>{typeof c.value==='number'?c.value.toLocaleString():c.value}</p>
          <p className="text-xs text-ink-400 mt-0.5">{c.sub}</p>
        </div>
      ))}
    </div>
  )
}
