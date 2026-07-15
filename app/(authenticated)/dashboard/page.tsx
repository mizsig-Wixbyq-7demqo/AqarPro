import Link from "next/link";
import {PropertyCard} from "@/components/property-card.tsx";
import {RoleBadge} from "@/components/role-badge.tsx";
import {can,roleLabels} from "@/lib/auth/permissions.ts";
import {requireAccessContext} from "@/lib/auth/session.ts";
import {getPortfolioDashboard} from "@/lib/data/portfolio.ts";
import {formatMoney,formatNumber,formatPercent,signedMoney} from "@/lib/domain/format.ts";
import {switchOrganizationAction} from "../organization-actions.ts";

function Metric({label,value,detail,tone="default"}:{label:string;value:string;detail:string;tone?:"default"|"good"|"danger"}){return <article className={`metric-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>}

export default async function Page(){
  const{memberships,activeMembership:m}=await requireAccessContext(),dashboard=await getPortfolioDashboard(m.organizationId),t=dashboard.totals;
  return <main className="dashboard-page">
    <header className="page-heading"><div><p className="eyebrow"><i/>لوحة المحفظة</p><h1>صباح الوضوح، هذه صورة محفظتك.</h1><span>{m.organizationName} · ملخص {dashboard.monthLabel}</span></div><div className="heading-actions"><RoleBadge role={m.role}/>{can(m.role,"properties:write")&&<Link className="primary-button compact" href="/properties#new-property">+ إضافة عقار</Link>}</div></header>
    {memberships.length>1&&<section className="org-switch"><div><b>المنشأة النشطة</b><span>كل البيانات أدناه معزولة داخل {m.organizationName}.</span></div><form action={switchOrganizationAction}><select name="organizationId" defaultValue={m.organizationId}>{memberships.map(x=><option key={x.organizationId} value={x.organizationId}>{x.organizationName} — {roleLabels[x.role]}</option>)}</select><button>تبديل</button></form></section>}
    <section className="portfolio-hero">
      <div><p>نبض المحفظة الآن</p><h2>{t.averageHealthScore===null?"لا توجد بيانات كافية":`${Math.round(t.averageHealthScore)} من 100`}</h2><span>{t.averageHealthScore===null?"أضف بيانات التشغيل لحساب المؤشر.":t.averageHealthScore>=80?"المحفظة مستقرة، مع فرص تحسين واضحة في الإيجارات.":t.averageHealthScore>=60?"الأداء مقبول ويحتاج متابعة التحصيل والشواغر.":"توجد إشارات تشغيلية تستحق المتابعة الآن."}</span></div>
      <div className="hero-orbit"><div style={{"--score":`${t.averageHealthScore??0}%`} as React.CSSProperties}><strong>{t.averageHealthScore===null?"—":Math.round(t.averageHealthScore)}</strong><small>الصحة التشغيلية</small></div></div>
      <dl><div><dt>صافي التدفق هذا الشهر</dt><dd className={t.netCashFlow>=0?"positive":"negative"}>{signedMoney(t.netCashFlow)}</dd></div><div><dt>نسبة الإشغال</dt><dd>{formatPercent(t.occupancyRate)}</dd></div><div><dt>المتأخرات القائمة</dt><dd>{formatMoney(t.overdueAmount)}</dd></div></dl>
    </section>
    <section className="metric-grid" aria-label="مؤشرات المحفظة">
      <Metric label="العقارات" value={formatNumber(t.properties)} detail="عقار نشط"/>
      <Metric label="إجمالي الوحدات" value={formatNumber(t.units)} detail={`${formatNumber(t.occupied)} مؤجرة · ${formatNumber(t.vacant)} شاغرة`}/>
      <Metric label="نسبة الإشغال" value={formatPercent(t.occupancyRate)} detail={`${formatNumber(t.maintenance)} صيانة · ${formatNumber(t.inactive)} غير نشطة`} tone="good"/>
      <Metric label="المستحق هذا الشهر" value={formatMoney(t.dueThisMonth)} detail={dashboard.monthLabel}/>
      <Metric label="المحصل هذا الشهر" value={formatMoney(t.collectedThisMonth)} detail={t.dueThisMonth?`${formatPercent(t.collectedThisMonth/t.dueThisMonth*100)} من المستحق`:"لا توجد استحقاقات"} tone="good"/>
      <Metric label="المتأخرات" value={formatMoney(t.overdueAmount)} detail="بعد خصم الدفعات الجزئية" tone={t.overdueAmount>0?"danger":"good"}/>
      <Metric label="المصروفات المدفوعة" value={formatMoney(t.expensesThisMonth)} detail={dashboard.monthLabel}/>
      <Metric label="صافي التدفق" value={signedMoney(t.netCashFlow)} detail="المحصل ناقص المصروفات" tone={t.netCashFlow>=0?"good":"danger"}/>
    </section>
    <section className="section-heading"><div><p>متابعة العقارات</p><h2>كل عقار في بطاقة واحدة</h2></div><Link href="/properties">عرض قائمة العقارات <span>←</span></Link></section>
    {dashboard.properties.length?<div className="property-grid">{dashboard.properties.map(property=><PropertyCard key={property.id} property={property}/>)}</div>:<section className="empty-state"><b>01</b><h2>ابدأ بأول عقار في محفظتك</h2><p>بعد إضافة العقار والوحدات ستظهر مؤشرات الإشغال والتحصيل والتدفق هنا تلقائيًا.</p>{can(m.role,"properties:write")&&<Link className="primary-button" href="/properties#new-property">إضافة أول عقار</Link>}</section>}
  </main>;
}
