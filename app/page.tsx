import Link from "next/link";
import {BrandMark} from "@/components/brand-mark.tsx";

export default function Home(){
  return <main className="landing" id="main-content" tabIndex={-1}>
    <header className="public-header">
      <BrandMark/>
      <nav aria-label="التنقل العام">
        <Link href="/login">تسجيل الدخول</Link>
        <Link className="small-primary" href="/register">ابدأ الآن</Link>
      </nav>
    </header>
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow"><i aria-hidden="true"/>إدارة عقارية مبنية على الأرقام</p>
        <h1>اعرف نبض عقارك<span>قبل أن تتحول التفاصيل إلى خسائر.</span></h1>
        <p className="hero-description">عقار برو يجمع الإشغال والتحصيل والمصروفات ومقارنة السوق في مكان واحد، ويحوّلها إلى مؤشرات واضحة تساعدك على اتخاذ القرار.</p>
        <div className="hero-actions">
          <Link className="primary-button" href="/register">أنشئ حسابك</Link>
          <Link className="secondary-button" href="/login">لدي حساب</Link>
        </div>
        <div className="trust" aria-label="مزايا الأمان والمراجعة">
          <span>عزل كامل بين المنشآت</span>
          <span>صلاحيات حسب الدور</span>
          <span>معادلات قابلة للمراجعة</span>
        </div>
      </div>
      <div className="hero-visual" aria-label="مثال توضيحي لبطاقة نبض العقار">
        <article className="pulse-card">
          <header><div><small>نبض العقار</small><h2>عمارة طويق 1</h2></div><b>صحة جيدة</b></header>
          <div className="score">
            <div className="score-ring"><strong>81</strong><small>/100</small></div>
            <div className="bars">
              <p><span>الإشغال</span><strong>87%</strong></p><i aria-hidden="true"><b style={{width:"87%"}}/></i>
              <p><span>التحصيل</span><strong>94%</strong></p><i aria-hidden="true"><b style={{width:"94%"}}/></i>
            </div>
          </div>
          <div className="insights"><div><small>صافي التدفق</small><strong>+38,000 ر.س</strong></div><div><small>فرصة دخل سنوية</small><strong>47,000 ر.س</strong></div></div>
          <footer>بيانات توضيحية وليست نتيجة فعلية</footer>
        </article>
      </div>
    </section>
  </main>;
}
