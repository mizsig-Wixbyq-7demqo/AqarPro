import {NoticeBanner} from "@/components/notice-banner.tsx";
import {PaymentWorkspace} from "@/components/operations/payment-workspace.tsx";
import {can} from "@/lib/auth/permissions.ts";
import {requireAccessContext} from "@/lib/auth/session.ts";
import {getPaymentsData} from "@/lib/data/operations.ts";

export default async function PaymentsPage({searchParams}:{searchParams:Promise<{property?:string;success?:string;error?:string}>}){
  const query=await searchParams,{activeMembership:m}=await requireAccessContext(),propertyId=query.property||undefined,data=await getPaymentsData(m.organizationId,propertyId),returnTo=propertyId?`/payments?property=${encodeURIComponent(propertyId)}`:"/payments";
  return <main className="operations-page">
    <header className="page-heading"><div><p className="eyebrow"><i/>الدفعات</p><h1>التحصيل واضح حتى آخر ريال.</h1><span>استحقاقات العقود والدفعات الكاملة والجزئية داخل {m.organizationName}</span></div>{can(m.role,"finance:write")&&<a className="primary-button compact" href="#collection-queue">تسجيل تحصيل</a>}</header>
    <NoticeBanner success={query.success} error={query.error}/>
    <form className="operation-filter" method="get"><label><span>عرض عقار</span><select name="property" defaultValue={propertyId??""}><option value="">كل العقارات</option>{data.properties.map(property=><option key={property.id} value={property.id}>{property.name}</option>)}</select></label><button type="submit">تطبيق</button></form>
    <div id="collection-queue"><PaymentWorkspace data={data} canWrite={can(m.role,"finance:write")} canDelete={can(m.role,"finance:delete")} returnTo={returnTo}/></div>
  </main>;
}
