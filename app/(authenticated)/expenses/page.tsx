import {NoticeBanner} from "@/components/notice-banner.tsx";
import {ExpenseWorkspace} from "@/components/operations/expense-workspace.tsx";
import {can} from "@/lib/auth/permissions.ts";
import {requireAccessContext} from "@/lib/auth/session.ts";
import {getExpensesData} from "@/lib/data/operations.ts";

export default async function ExpensesPage({searchParams}:{searchParams:Promise<{property?:string;success?:string;error?:string}>}){
  const query=await searchParams,{activeMembership:m}=await requireAccessContext(),propertyId=query.property||undefined,data=await getExpensesData(m.organizationId,propertyId),returnTo=propertyId?`/expenses?property=${encodeURIComponent(propertyId)}`:"/expenses";
  return <main className="operations-page">
    <header className="page-heading"><div><p className="eyebrow"><i/>المصروفات</p><h1>كل تكلفة في مكانها الصحيح.</h1><span>مصروفات العقارات والوحدات وأثرها المباشر في التدفق النقدي</span></div>{can(m.role,"finance:write")&&<a className="primary-button compact" href="#new-expense">+ إضافة مصروف</a>}</header>
    <NoticeBanner success={query.success} error={query.error}/>
    <form className="operation-filter" method="get"><label><span>عرض عقار</span><select name="property" defaultValue={propertyId??""}><option value="">كل العقارات</option>{data.properties.map(property=><option key={property.id} value={property.id}>{property.name}</option>)}</select></label><button type="submit">تطبيق</button></form>
    <ExpenseWorkspace data={data} canWrite={can(m.role,"finance:write")} canDelete={can(m.role,"finance:delete")} canManageCategories={can(m.role,"properties:write")} returnTo={returnTo}/>
  </main>;
}
