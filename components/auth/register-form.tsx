"use client";

import Link from "next/link";
import {useActionState} from "react";
import {useFormStatus} from "react-dom";
import {signUpAction} from "@/app/auth/actions.ts";
import {initialActionState} from "@/lib/auth/action-state.ts";

function Submit(){
  const{pending}=useFormStatus();
  return <button className="primary-button full" type="submit" disabled={pending} aria-disabled={pending}>{pending?"جارٍ إنشاء الحساب…":"إنشاء الحساب"}</button>;
}

export function RegisterForm(){
  const[state,action]=useActionState(signUpAction,initialActionState);
  return <form action={action} className="auth-form" noValidate>
    <label htmlFor="fullName">الاسم الكامل</label>
    <input className="text-field" id="fullName" name="fullName" autoComplete="name" minLength={2} maxLength={80} required placeholder="الاسم الكامل" aria-invalid={Boolean(state.fieldErrors?.fullName)} aria-describedby={state.fieldErrors?.fullName?"register-name-error":undefined}/>
    {state.fieldErrors?.fullName&&<small className="field-error" id="register-name-error">{state.fieldErrors.fullName}</small>}
    <label htmlFor="email">البريد الإلكتروني</label>
    <input className="text-field" id="email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} required placeholder="name@example.com" aria-invalid={Boolean(state.fieldErrors?.email)} aria-describedby={state.fieldErrors?.email?"register-email-error":undefined}/>
    {state.fieldErrors?.email&&<small className="field-error" id="register-email-error">{state.fieldErrors.email}</small>}
    <label htmlFor="password">كلمة المرور</label>
    <input className="text-field" id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required placeholder="8 أحرف على الأقل" aria-invalid={Boolean(state.fieldErrors?.password)} aria-describedby={state.fieldErrors?.password?"register-password-error":undefined}/>
    {state.fieldErrors?.password&&<small className="field-error" id="register-password-error">{state.fieldErrors.password}</small>}
    {state.message&&<p className={`form-message ${state.status}`} role={state.status==="error"?"alert":"status"}>{state.message}</p>}
    <Submit/>
    <p className="auth-switch">لديك حساب؟ <Link href="/login">سجّل الدخول</Link></p>
  </form>;
}
