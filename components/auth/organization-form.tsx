"use client";

import {useActionState} from "react";
import {useFormStatus} from "react-dom";
import {createOrganizationAction} from "@/app/(authenticated)/organization-actions.ts";
import {initialActionState} from "@/lib/auth/action-state.ts";

function Submit(){
  const{pending}=useFormStatus();
  return <button className="primary-button full" type="submit" disabled={pending} aria-disabled={pending}>{pending?"جارٍ تجهيز المنشأة…":"إنشاء المنشأة والمتابعة"}</button>;
}

export function OrganizationForm(){
  const[state,action]=useActionState(createOrganizationAction,initialActionState),descriptionId=state.fieldErrors?.organizationName?"organization-name-error":"organization-name-hint";
  return <form action={action} className="auth-form">
    <label htmlFor="organizationName">اسم المنشأة أو المحفظة</label>
    <input className="text-field large" id="organizationName" name="organizationName" minLength={3} maxLength={80} required placeholder="مثال: محفظة رواسي العقارية" aria-invalid={Boolean(state.fieldErrors?.organizationName)} aria-describedby={descriptionId}/>
    {state.fieldErrors?.organizationName&&<small className="field-error" id="organization-name-error">{state.fieldErrors.organizationName}</small>}
    <p className="field-hint" id="organization-name-hint">يمكنك تعديل الاسم وإضافة منشآت أخرى لاحقًا.</p>
    {state.message&&<p className="form-message error" role="alert">{state.message}</p>}
    <Submit/>
  </form>;
}
