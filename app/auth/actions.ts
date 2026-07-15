"use server";
import { redirect } from "next/navigation";
import { getPublicSiteOrigin,getSupabasePublicConfig } from "@/lib/supabase/config.ts";
import { createClient } from "@/lib/supabase/server.ts";
import type { ActionState } from "@/lib/auth/action-state.ts";
import { resolvePostAuthPath,sanitizeNextPath } from "@/lib/auth/navigation.ts";
import {isValidEmail} from "@/lib/domain/validation.ts";
const value=(data:FormData,key:string)=>{const v=data.get(key);return typeof v==="string"?v.trim():"";};
const unavailable=():ActionState|null=>getSupabasePublicConfig()?null:{status:"error",message:"لم يكتمل ربط خدمة المصادقة بعد. أضف متغيرات Supabase ثم أعد المحاولة."};
const message=(code?:string)=>code==="invalid_credentials"?"البريد الإلكتروني أو كلمة المرور غير صحيحة.":code==="email_not_confirmed"?"يلزم تأكيد البريد الإلكتروني قبل تسجيل الدخول.":code==="user_already_exists"||code==="email_exists"?"يوجد حساب مسجل بهذا البريد الإلكتروني.":"تعذر إكمال العملية الآن. تحقق من البيانات وحاول مرة أخرى.";
export async function signInAction(_:ActionState,data:FormData):Promise<ActionState>{
  const e=unavailable();if(e)return e;const email=value(data,"email").toLowerCase(),password=value(data,"password"),fieldErrors:ActionState["fieldErrors"]={};
  if(!isValidEmail(email))fieldErrors.email="أدخل بريدًا إلكترونيًا صحيحًا.";if(!password||password.length>128)fieldErrors.password="أدخل كلمة مرور صحيحة.";if(Object.keys(fieldErrors).length)return{status:"error",message:"راجع الحقول الموضحة.",fieldErrors};
  const s=await createClient();const {data:auth,error}=await s.auth.signInWithPassword({email,password});if(error||!auth.user)return{status:"error",message:message(error?.code)};
  const {count}=await s.from("organization_members").select("id",{count:"exact",head:true}).eq("user_id",auth.user.id);redirect(resolvePostAuthPath(count??0,sanitizeNextPath(data.get("next"))));
}
export async function signUpAction(_:ActionState,data:FormData):Promise<ActionState>{
  const e=unavailable();if(e)return e;const fullName=value(data,"fullName"),email=value(data,"email").toLowerCase(),password=value(data,"password"),fieldErrors:ActionState["fieldErrors"]={};
  if(fullName.length<2||fullName.length>80)fieldErrors.fullName="اكتب اسمًا من 2 إلى 80 حرفًا.";if(!isValidEmail(email))fieldErrors.email="أدخل بريدًا إلكترونيًا صحيحًا.";if(password.length<8||password.length>128)fieldErrors.password="استخدم كلمة مرور من 8 إلى 128 حرفًا.";if(Object.keys(fieldErrors).length)return{status:"error",message:"راجع الحقول الموضحة.",fieldErrors};
  const origin=getPublicSiteOrigin();if(!origin)return{status:"error",message:"يلزم ضبط عنوان الموقع الموثوق قبل إنشاء الحساب."};
  const s=await createClient();const {data:auth,error}=await s.auth.signUp({email,password,options:{data:{full_name:fullName},emailRedirectTo:`${origin}/auth/confirm?next=/onboarding`}});if(error)return{status:"error",message:message(error.code)};if(auth.session)redirect("/onboarding");return{status:"success",message:"أُنشئ الحساب. افتح رسالة التأكيد في بريدك الإلكتروني، ثم أكمل إعداد المنشأة."};
}
export async function signOutAction(){if(getSupabasePublicConfig()){const s=await createClient();await s.auth.signOut();}redirect("/login");}
