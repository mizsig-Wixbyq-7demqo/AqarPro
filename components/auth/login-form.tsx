"use client";

import Link from "next/link";
import {useActionState} from "react";
import {useFormStatus} from "react-dom";
import {signInAction} from "@/app/auth/actions.ts";
import {initialActionState} from "@/lib/auth/action-state.ts";

function Submit(){
  const{pending}=useFormStatus();
  return <button className="primary-button full" type="submit" disabled={pending} aria-disabled={pending}>{pending?"جارٍ التحقق…":"تسجيل الدخول"}</button>;
}

export function LoginForm({nextPath}:{nextPath:string}){
  const[state,action]=useActionState(signInAction,initialActionState);
  return <form action={action} className="auth-form" noValidate>
    <input type="hidden" name="next" value={nextPath}/>
    <label htmlFor="email">البريد الإلكتروني</label>
    <input className="text-field" id="email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} required placeholder="name@example.com" aria-invalid={Boolean(state.fieldErrors?.email)} aria-describedby={state.fieldErrors?.email?"login-email-error":undefined}/>
    {state.fieldErrors?.email&&<small className="field-error" id="login-email-error">{state.fieldErrors.email}</small>}
    <label htmlFor="password">كلمة المرور</label>
    <input className="text-field" id="password" name="password" type="password" autoComplete="current-password" minLength={8} maxLength={128} required placeholder="••••••••" aria-invalid={Boolean(state.fieldErrors?.password)} aria-describedby={state.fieldErrors?.password?"login-password-error":undefined}/>
    {state.fieldErrors?.password&&<small className="field-error" id="login-password-error">{state.fieldErrors.password}</small>}
    {state.message&&<p className={`form-message ${state.status}`} role={state.status==="error"?"alert":"status"}>{state.message}</p>}
    <Submit/>
    <p className="auth-switch">مستخدم جديد؟ <Link href="/register">أنشئ حسابك</Link></p>
  </form>;
}
