import {NoticeBanner} from "@/components/notice-banner.tsx";
import {ScoreHistoryWorkspace} from "@/components/operations/score-history-workspace.tsx";
import {can} from "@/lib/auth/permissions.ts";
import {requireAccessContext} from "@/lib/auth/session.ts";
import {getOperationPropertyOptions,getScoreHistoryData} from "@/lib/data/operations.ts";

export default async function ScoreHistoryPage({searchParams}:{searchParams:Promise<{property?:string;success?:string;error?:string}>}){
  const query=await searchParams,{activeMembership:m}=await requireAccessContext(),propertyId=query.property||undefined,[data,propertyOptions]=await Promise.all([getScoreHistoryData(m.organizationId,propertyId),getOperationPropertyOptions(m.organizationId)]),returnTo=propertyId?`/score-history?property=${encodeURIComponent(propertyId)}`:"/score-history";
  return <main className="operations-page">
    <header className="page-heading"><div><p className="eyebrow"><i/>سجل المؤشرات</p><h1>تاريخ الأداء محفوظ كما حُسب.</h1><span>لقطات غير قابلة للتعديل تحفظ المدخلات والنتائج وإصدار المعادلة</span></div></header>
    <NoticeBanner success={query.success} error={query.error}/>
    <form className="operation-filter" method="get"><label><span>عرض عقار</span><select name="property" defaultValue={propertyId??""}><option value="">كل العقارات</option>{propertyOptions.map(property=><option key={property.id} value={property.id}>{property.name}</option>)}</select></label><button type="submit">تطبيق</button></form>
    <ScoreHistoryWorkspace data={data} canCreate={can(m.role,"snapshots:create")} returnTo={returnTo}/>
  </main>;
}
