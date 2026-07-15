import Link from "next/link";
import type { PropertyCardData } from "@/lib/data/portfolio.ts";
import { formatMoney, formatPercent, signedMoney } from "@/lib/domain/format.ts";
import { formatArabicDate } from "@/lib/domain/business-date.ts";

function scoreTone(score:number|null){if(score===null)return"neutral";if(score>=80)return"good";if(score>=60)return"warning";return"danger";}

export function PropertyCard({property}:{property:PropertyCardData}){
  const gap=property.rentGapPercentage;
  return <article className="property-card">
    <header>
      <div className="building-glyph" aria-hidden="true"><i/><i/><i/><i/></div>
      <div><small>{property.property_type}</small><h3>{property.name}</h3><p>{property.city}، {property.district}</p></div>
      <div className={`health-pill ${scoreTone(property.operatingHealthScore)}`}><span>الصحة</span><strong>{property.operatingHealthScore===null?"—":Math.round(property.operatingHealthScore)}</strong><small>/100</small></div>
    </header>
    <div className="property-kpis">
      <div><span>الإشغال</span><strong>{formatPercent(property.occupancyRate)}</strong><i><b style={{width:`${Math.min(100,property.occupancyRate??0)}%`}}/></i></div>
      <div><span>التحصيل</span><strong>{formatPercent(property.collectionRate)}</strong><i><b style={{width:`${Math.min(100,property.collectionRate??0)}%`}}/></i></div>
    </div>
    <dl className="property-finance">
      <div><dt>صافي التدفق</dt><dd className={property.netCashFlow>=0?"positive":"negative"}>{signedMoney(property.netCashFlow)}</dd></div>
      <div><dt>فجوة الإيجار</dt><dd>{gap===null?"لا توجد بيانات كافية":gap<0?`أقل من السوق بـ${formatPercent(Math.abs(gap))}`:gap>0?`أعلى من السوق بـ${formatPercent(gap)}`:"قريب من السوق"}</dd></div>
      <div><dt>فرصة الدخل السنوي</dt><dd>{formatMoney(property.possibleAnnualIncrease)}</dd></div>
    </dl>
    <footer>
      <div><strong>{property.total_units}</strong><span>وحدة</span></div>
      <div><strong>{property.expiringLeases}</strong><span>عقد ينتهي خلال 90 يومًا</span></div>
      <Link href={`/properties/${property.id}`}>فتح العقار <span aria-hidden="true">←</span></Link>
    </footer>
    <p className="snapshot-stamp">آخر تحديث للمؤشر: {formatArabicDate(property.snapshotDate)}</p>
  </article>;
}
