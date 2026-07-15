import Link from "next/link";
import {BrandMark} from "@/components/brand-mark.tsx";
import {RegisterForm} from "@/components/auth/register-form.tsx";
import {getPublicSiteOrigin,getSupabasePublicConfig} from "@/lib/supabase/config.ts";

export const dynamic="force-dynamic";

export default function RegisterPage(){
  const configured=Boolean(getSupabasePublicConfig()&&getPublicSiteOrigin());
  return <main className="auth-shell" id="main-content" tabIndex={-1}>
    <section className="auth-panel"><div className="auth-inner">
      <BrandMark/>
      <div className="auth-heading compact"><p className="eyebrow">ابدأ بخطوة واحدة</p><h1>أنشئ حساب عقار برو</h1><span>بعد تأكيد البريد ستنشئ محفظتك وتصبح المالك تلقائيًا.</span></div>
      {!configured&&<div className="config-note" role="status"><strong>وضع الاستعراض</strong><span>إنشاء الحساب يتفعّل بعد ربط Supabase وضبط عنوان الموقع الموثوق.</span></div>}
      <RegisterForm/>
      <Link className="back" href="/">العودة للرئيسية</Link>
    </div></section>
    <aside className="auth-story" aria-label="خطوات إعداد الحساب"><div><p>إعداد سريع وآمن</p><h2>من الحساب إلى أول عقار، بخطوات واضحة.</h2><ol><li><b>1</b><span><strong>أنشئ الحساب</strong><small>بريدك وكلمة مرور آمنة</small></span></li><li><b>2</b><span><strong>سمِّ المنشأة</strong><small>وتصبح مالكها مباشرة</small></span></li><li><b>3</b><span><strong>ابدأ إدارة المحفظة</strong><small>دون خلط بيانات المنشآت</small></span></li></ol></div></aside>
  </main>;
}
