import Link from "next/link";
import {redirect} from "next/navigation";
import {BrandMark} from "@/components/brand-mark.tsx";
import {AppNavigation} from "@/components/app-navigation.tsx";
import {signOutAction} from "@/app/auth/actions.ts";
import {getSupabasePublicConfig} from "@/lib/supabase/config.ts";
import {requireUser} from "@/lib/auth/session.ts";
import {getRiyadhToday,formatArabicDate} from "@/lib/domain/business-date.ts";

export const dynamic="force-dynamic";

export default async function Layout({children}:{children:React.ReactNode}){
  if(!getSupabasePublicConfig())redirect("/login?error=configuration");
  const user=await requireUser(),name=typeof user.user_metadata?.full_name==="string"?user.user_metadata.full_name:user.email;
  return <div className="app-shell">
    <aside className="app-sidebar"><div className="sidebar-brand"><BrandMark/><small>إدارة العقارات بوضوح</small></div><AppNavigation/><div className="sidebar-help"><b>نسخة التشغيل الأولى</b><span>كل رقم مرتبط بسجل قابل للمراجعة.</span></div></aside>
    <div className="app-main">
      <header className="app-topbar"><div><p>اليوم</p><strong>{formatArabicDate(getRiyadhToday())}</strong></div><div className="account"><span>{name?.trim().charAt(0)||"م"}</span><div><strong>{name}</strong><small>جلسة آمنة</small></div><form action={signOutAction}><button>تسجيل الخروج</button></form></div></header>
      <div className="app-content" id="main-content" tabIndex={-1}>{children}</div>
      <footer className="app-footer"><span>عقار برو · مؤشرات قابلة للمراجعة</span><Link href="/">الصفحة الرئيسية</Link></footer>
    </div>
  </div>;
}
