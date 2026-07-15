"use client";
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){return <main className="error-state"><b>!</b><h1>تعذر تحميل البيانات الآن</h1><p>تحقق من اتصال قاعدة البيانات ثم أعد المحاولة. لم يتم تغيير أي سجل.</p><button className="primary-button" onClick={()=>reset()}>إعادة المحاولة</button></main>}
