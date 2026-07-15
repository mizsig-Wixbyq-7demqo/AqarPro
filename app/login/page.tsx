import Link from "next/link";
import {BrandMark} from "@/components/brand-mark.tsx";
import {LoginForm} from "@/components/auth/login-form.tsx";
import {getSupabasePublicConfig} from "@/lib/supabase/config.ts";
import {sanitizeNextPath} from "@/lib/auth/navigation.ts";

export const dynamic="force-dynamic";

export default async function LoginPage({searchParams}:{searchParams:Promise<{next?:string;error?:string}>}){
  const params=await searchParams,configured=Boolean(getSupabasePublicConfig());
  return <main className="auth-shell" id="main-content" tabIndex={-1}>
    <section className="auth-panel">
      <div className="auth-inner">
        <BrandMark/>
        <div className="auth-heading"><p className="eyebrow">مرحبًا بعودتك</p><h1>سجّل الدخول إلى محفظتك</h1><span>تابع أداء عقاراتك وقراراتك التشغيلية من مكان واحد.</span></div>
        {!configured&&<div className="config-note" role="status"><strong>وضع الاستعراض</strong><span>يلزم ربط إعدادات Supabase لتفعيل إنشاء الحساب والدخول.</span></div>}
        {params.error==="confirmation"&&<p className="form-message error" role="alert">رابط التأكيد غير صالح أو انتهت صلاحيته.</p>}
        <LoginForm nextPath={sanitizeNextPath(params.next??null)}/>
        <Link className="back" href="/">العودة للرئيسية</Link>
      </div>
    </section>
    <aside className="auth-story" aria-label="مزايا عقار برو"><div><p>وضوح تشغيلي يومي</p><blockquote>«بدل أن تبحث بين الجداول والرسائل، ترى ما يستحق انتباهك أولًا.»</blockquote><ul><li><b>01</b>قراءة واحدة لصحة المحفظة</li><li><b>02</b>بيانات كل منشأة معزولة بالكامل</li><li><b>03</b>كل مستخدم يرى ما يسمح به دوره فقط</li></ul></div></aside>
  </main>;
}
