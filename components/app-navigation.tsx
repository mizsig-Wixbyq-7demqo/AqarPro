"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";

type NavIconName="dashboard"|"properties"|"payments"|"expenses"|"market"|"history";

function NavIcon({name}:{name:NavIconName}){
  const common={fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
  return <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true" focusable="false" {...common}>
    {name==="dashboard"&&<><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="10.5" width="7" height="10" rx="1.5"/></>}
    {name==="properties"&&<><path d="M5 20.5V5.8a1.8 1.8 0 0 1 1.2-1.7l5-1.6a1.8 1.8 0 0 1 2.3 1.7v16.3"/><path d="M13.5 8.5h4.8a1.7 1.7 0 0 1 1.7 1.7v10.3M3 20.5h18M8.2 7.5h2M8.2 11h2M8.2 14.5h2M16.5 12h1M16.5 15h1"/></>}
    {name==="payments"&&<><path d="M4 7.5h14.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-14A2.5 2.5 0 0 1 2 17.5v-12A2.5 2.5 0 0 1 4.5 3H17"/><path d="M15 12h6v4h-6a2 2 0 1 1 0-4Z"/><circle cx="16" cy="14" r=".55" fill="currentColor" stroke="none"/></>}
    {name==="expenses"&&<><path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3v-17Z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/></>}
    {name==="market"&&<><path d="M4 20V11M10 20V7M16 20V14M22 20H2"/><path d="m4 7 5-4 5 4 6-5"/></>}
    {name==="history"&&<><path d="M3.5 12a8.5 8.5 0 1 0 2.2-5.7L3.5 8.5"/><path d="M3.5 4.5v4h4M12 7.5v5l3.2 2"/></>}
  </svg>;
}

const sections=[
  {label:"إدارة المحفظة",links:[{href:"/dashboard",label:"لوحة المحفظة",icon:"dashboard"},{href:"/properties",label:"العقارات",icon:"properties"}]},
  {label:"الماليات",links:[{href:"/payments",label:"الدفعات",icon:"payments"},{href:"/expenses",label:"المصروفات",icon:"expenses"}]},
  {label:"التحليل",links:[{href:"/market-benchmarks",label:"مقارنة السوق",icon:"market"},{href:"/score-history",label:"سجل المؤشرات",icon:"history"}]},
] as const;

export function AppNavigation(){
  const pathname=usePathname();
  return <nav className="app-navigation" aria-label="التنقل الرئيسي">
    {sections.map(section=><div className="nav-section" key={section.label}>
      <p>{section.label}</p>
      {section.links.map(link=>{
        const active=pathname===link.href||(link.href==="/properties"&&pathname.startsWith("/properties/"));
        return <Link key={link.href} href={link.href} className={active?"active":""} aria-current={active?"page":undefined}><b><NavIcon name={link.icon}/></b><span>{link.label}</span></Link>;
      })}
    </div>)}
  </nav>;
}
