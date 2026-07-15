import Link from "next/link";
import {PropertyCard} from "@/components/property-card.tsx";
import {NoticeBanner} from "@/components/notice-banner.tsx";
import {can} from "@/lib/auth/permissions.ts";
import {requireAccessContext} from "@/lib/auth/session.ts";
import {getPortfolioDashboard} from "@/lib/data/portfolio.ts";
import {createPropertyAction} from "./actions.ts";

export default async function PropertiesPage({searchParams}:{searchParams:Promise<{success?:string;error?:string}>}){
  const params=await searchParams,{activeMembership:m}=await requireAccessContext(),dashboard=await getPortfolioDashboard(m.organizationId),canWrite=can(m.role,"properties:write");
  return <main className="properties-page">
    <header className="page-heading"><div><p className="eyebrow"><i/>العقارات</p><h1>أصولك مرتبة وقابلة للمتابعة.</h1><span>{dashboard.properties.length} عقار · {dashboard.totals.units} وحدة ضمن {m.organizationName}</span></div>{canWrite&&<a className="primary-button compact" href="#new-property">+ إضافة عقار</a>}</header>
    <NoticeBanner success={params.success} error={params.error}/>
    <div className="property-grid list-view">{dashboard.properties.map(property=><PropertyCard key={property.id} property={property}/>)}</div>
    {!dashboard.properties.length&&!canWrite&&<section className="empty-state"><h2>لا توجد عقارات حتى الآن</h2><p>يمكن للمالك أو المدير إضافة أول عقار.</p><Link href="/dashboard">العودة للوحة المحفظة</Link></section>}
    {canWrite&&<section className="form-panel" id="new-property"><header><div><p>الخطوة 1 من 4</p><h2>بيانات العقار الأساسية</h2></div><span>تُحفظ فورًا ويمكن إكمال الباقي لاحقًا</span></header><form action={createPropertyAction} className="data-form"><label><span>اسم العقار *</span><input name="name" required minLength={2} maxLength={100} placeholder="مثال: عمارة طويق 2"/></label><label><span>نوع العقار *</span><select name="propertyType" defaultValue="عمارة سكنية"><option>عمارة سكنية</option><option>مجمع سكني</option><option>فيلا</option><option>مبنى تجاري</option><option>مستودع</option></select></label><label><span>المدينة *</span><input name="city" required defaultValue="الرياض"/></label><label><span>الحي *</span><input name="district" required placeholder="مثال: العارض"/></label><label className="wide"><span>العنوان</span><input name="address" maxLength={220} placeholder="وصف مختصر للموقع دون بيانات زائدة"/></label><label><span>تاريخ الاستحواذ</span><input name="acquisitionDate" type="date"/></label><label className="wide"><span>ملاحظات</span><textarea name="notes" maxLength={700} rows={3} placeholder="معلومة تشغيلية تساعد فريق الإدارة"/></label><div className="form-actions workflow-actions wide"><button className="secondary-button" type="submit" name="submitChoice" value="stay">حفظ وعرض العقار</button><button className="primary-button" type="submit" name="submitChoice" value="continue">حفظ والمتابعة للوحدات ←</button><small>يمكنك التوقف بعد الحفظ والعودة لاحقًا.</small></div></form></section>}
  </main>;
}
