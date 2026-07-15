import {NoticeBanner} from "@/components/notice-banner.tsx";
import {MarketWorkspace} from "@/components/operations/market-workspace.tsx";
import {can} from "@/lib/auth/permissions.ts";
import {requireAccessContext} from "@/lib/auth/session.ts";
import {getMarketData} from "@/lib/data/operations.ts";

export default async function MarketBenchmarksPage({searchParams}:{searchParams:Promise<{property?:string;success?:string;error?:string}>}){
  const query=await searchParams,{activeMembership:m}=await requireAccessContext(),propertyId=query.property||undefined,data=await getMarketData(m.organizationId,propertyId),returnTo=propertyId?`/market-benchmarks?property=${encodeURIComponent(propertyId)}`:"/market-benchmarks";
  return <main className="operations-page">
    <header className="page-heading"><div><p className="eyebrow"><i/>مقارنة السوق</p><h1>السوق مرجع، وليس تخمينًا.</h1><span>مقارنة موثقة لكل وحدة دون خلط أنواع المصادر أو إخفاء نقص البيانات</span></div>{can(m.role,"benchmarks:write")&&<a className="primary-button compact" href="#new-benchmark">+ مرجع سوق</a>}</header>
    <NoticeBanner success={query.success} error={query.error}/>
    <form className="operation-filter" method="get"><label><span>عرض عقار</span><select name="property" defaultValue={propertyId??""}><option value="">كل العقارات</option>{data.properties.map(property=><option key={property.id} value={property.id}>{property.name}</option>)}</select></label><button type="submit">تطبيق</button></form>
    <MarketWorkspace data={data} canWrite={can(m.role,"benchmarks:write")} canDelete={can(m.role,"benchmarks:delete")} returnTo={returnTo}/>
  </main>;
}
