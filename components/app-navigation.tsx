"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";

const sections=[
  {label:"إدارة المحفظة",links:[{href:"/dashboard",label:"لوحة المحفظة",icon:"نب"},{href:"/properties",label:"العقارات",icon:"عق"}]},
  {label:"الماليات",links:[{href:"/payments",label:"الدفعات",icon:"دف"},{href:"/expenses",label:"المصروفات",icon:"صر"}]},
  {label:"التحليل",links:[{href:"/market-benchmarks",label:"مقارنة السوق",icon:"سو"},{href:"/score-history",label:"سجل المؤشرات",icon:"سج"}]},
] as const;

export function AppNavigation(){
  const pathname=usePathname();
  return <nav className="app-navigation" aria-label="التنقل الرئيسي">
    {sections.map(section=><div className="nav-section" key={section.label}>
      <p>{section.label}</p>
      {section.links.map(link=>{
        const active=pathname===link.href||(link.href==="/properties"&&pathname.startsWith("/properties/"));
        return <Link key={link.href} href={link.href} className={active?"active":""} aria-current={active?"page":undefined}><b aria-hidden="true">{link.icon}</b><span>{link.label}</span></Link>;
      })}
    </div>)}
  </nav>;
}
