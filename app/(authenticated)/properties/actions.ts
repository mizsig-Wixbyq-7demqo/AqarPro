"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/permissions.ts";
import { requireAccessContext, requireCapability } from "@/lib/auth/session.ts";
import { getRiyadhToday } from "@/lib/domain/business-date.ts";
import { generatePaymentSchedule, paymentFrequencies, type PaymentFrequency } from "@/lib/domain/payment-schedule.ts";
import {isUuid,isValidEmail,isValidIsoDate} from "@/lib/domain/validation.ts";
import { createClient } from "@/lib/supabase/server.ts";

const unitStatuses = ["occupied", "vacant", "maintenance", "inactive"] as const;

function text(data:FormData,name:string,max=160) {
  const value=data.get(name);
  return typeof value==="string"?value.trim().slice(0,max):"";
}
function optionalText(data:FormData,name:string,max=500) { return text(data,name,max)||null; }
function number(data:FormData,name:string,{min=0,max=99_999_999,optional=false}:{min?:number;max?:number;optional?:boolean}={}) {
  const raw=text(data,name,40);
  if(optional&&!raw)return null;
  const value=Number(raw);
  if(!Number.isFinite(value)||value<min||value>max)throw new Error("قيمة رقمية غير صحيحة.");
  return value;
}
function integer(data:FormData,name:string,{min=0,max=1_000,optional=false}:{min?:number;max?:number;optional?:boolean}={}) {
  const value=number(data,name,{min,max,optional});
  if(value===null)return null;
  if(!Number.isInteger(value))throw new Error("اكتب رقمًا صحيحًا.");
  return value;
}
function id(data:FormData,name:string) {
  const value=text(data,name,40);
  if(!isUuid(value))throw new Error("المعرّف غير صحيح.");
  return value;
}
function optionalPastDate(data:FormData,name:string){const value=text(data,name,10);if(!value)return null;if(!isValidIsoDate(value)||value>getRiyadhToday())throw new Error("التاريخ غير صحيح أو يقع في المستقبل.");return value;}
function target(propertyId?:string,tab?:string,anchor?:string) { return propertyId?`/properties/${propertyId}${tab?`?tab=${tab}`:""}${anchor?`#${anchor}`:""}`:`/properties${anchor?`#${anchor}`:""}`; }
function submitChoice(data:FormData){const value=text(data,"submitChoice",24);return value==="continue"||value==="add-another"?value:"stay";}
function finish(path:string,message:string,tone:"success"|"error"="success"):never {
  const [base="/",fragment]=path.split("#",2),separator=base.includes("?")?"&":"?";
  redirect(`${base}${separator}${tone}=${encodeURIComponent(message)}${fragment?`#${fragment}`:""}`);
}
function isRedirectSignal(error:unknown) {
  if(!(error instanceof Error))return false;
  const digest=(error as Error&{digest?:unknown}).digest;
  return error.message==="NEXT_REDIRECT"||error.message.startsWith("NEXT_REDIRECT:")||(typeof digest==="string"&&digest.startsWith("NEXT_REDIRECT"));
}
function friendlyError(error:{code?:string}|null,fallback:string) {
  if(error?.code==="23505")return "يوجد سجل آخر بالرقم نفسه.";
  if(error?.code==="23P01")return "الوحدة مرتبطة بعقد متداخل في الفترة نفسها.";
  if(error?.code==="42501")return "ليس لديك الصلاحية اللازمة لهذه العملية.";
  return fallback;
}

export async function createPropertyAction(data:FormData) {
  const context=await requireCapability("properties:write"),path=target(undefined,undefined,"new-property");
  try{
    const name=text(data,"name",100),propertyType=text(data,"propertyType",60),city=text(data,"city",60),district=text(data,"district",60);
    if(name.length<2||!propertyType||!city||!district)finish(path,"أكمل اسم العقار ونوعه والمدينة والحي.","error");
    const supabase=await createClient();
    const{data:property,error}=await supabase.from("properties").insert({organization_id:context.activeMembership.organizationId,name,property_type:propertyType,city,district,address:optionalText(data,"address",220),acquisition_date:optionalPastDate(data,"acquisitionDate"),notes:optionalText(data,"notes",700)}).select("id").single();
    if(error||!property)finish(path,friendlyError(error,"تعذر إضافة العقار."),"error");
    revalidatePath("/dashboard");revalidatePath("/properties");
    const destination=submitChoice(data)==="continue"?target(property.id,"units","new-unit"):target(property.id,"overview");
    finish(destination,"تمت إضافة العقار بنجاح، ويمكنك إكمال بياناته في أي وقت.");
  }catch(error){if(isRedirectSignal(error))throw error;finish(path,error instanceof Error?error.message:"راجع بيانات العقار.","error");}
}

export async function updatePropertyAction(data:FormData) {
  const context=await requireCapability("properties:write"),propertyId=id(data,"propertyId"),path=target(propertyId,"overview");
  try{
    const name=text(data,"name",100),propertyType=text(data,"propertyType",60),city=text(data,"city",60),district=text(data,"district",60);
    if(name.length<2||!propertyType||!city||!district)finish(path,"أكمل الحقول الأساسية للعقار.","error");
    const supabase=await createClient();
    const{error}=await supabase.from("properties").update({name,property_type:propertyType,city,district,address:optionalText(data,"address",220),acquisition_date:optionalPastDate(data,"acquisitionDate"),notes:optionalText(data,"notes",700)}).eq("organization_id",context.activeMembership.organizationId).eq("id",propertyId).is("deleted_at",null);
    if(error)finish(path,friendlyError(error,"تعذر تحديث العقار."),"error");
    revalidatePath("/dashboard");revalidatePath("/properties");revalidatePath(`/properties/${propertyId}`);
    finish(path,"تم حفظ بيانات العقار.");
  }catch(error){if(isRedirectSignal(error))throw error;finish(path,error instanceof Error?error.message:"راجع بيانات العقار.","error");}
}

export async function deletePropertyAction(data:FormData) {
  const context=await requireCapability("properties:delete"),propertyId=id(data,"propertyId"),path=target(propertyId,"overview"),supabase=await createClient();
  const{data:unit}=await supabase.from("units").select("id").eq("organization_id",context.activeMembership.organizationId).eq("property_id",propertyId).is("deleted_at",null).limit(1).maybeSingle();
  if(unit)finish(path,"لا يمكن حذف عقار يحتوي على وحدات. احذف الوحدات أولًا.","error");
  const{error}=await supabase.from("properties").update({deleted_at:new Date().toISOString()}).eq("organization_id",context.activeMembership.organizationId).eq("id",propertyId).is("deleted_at",null);
  if(error)finish(path,"تعذر حذف العقار.","error");
  revalidatePath("/dashboard");revalidatePath("/properties");
  finish("/properties","تم حذف العقار منطقيًا مع الاحتفاظ بسجل المراجعة.");
}

function unitPayload(data:FormData) {
  const status=text(data,"status",20);
  if(!unitStatuses.includes(status as (typeof unitStatuses)[number]))throw new Error("حالة الوحدة غير صحيحة.");
  const unitNumber=text(data,"unitNumber",40),unitType=text(data,"unitType",60);
  if(!unitNumber||!unitType)throw new Error("رقم الوحدة ونوعها مطلوبان.");
  return {unitNumber,unitType,bedrooms:integer(data,"bedrooms",{max:30,optional:true}),bathrooms:number(data,"bathrooms",{max:30,optional:true}),areaSqm:number(data,"areaSqm",{min:.1,max:100_000,optional:true}),floorNumber:integer(data,"floorNumber",{min:-20,max:300,optional:true}),status:status as (typeof unitStatuses)[number],currentAnnualRent:number(data,"currentAnnualRent",{max:99_999_999,optional:true}),notes:optionalText(data,"notes",700)};
}

export async function createUnitAction(data:FormData) {
  const context=await requireCapability("properties:write"),propertyId=id(data,"propertyId"),path=target(propertyId,"units","new-unit");
  try{
    const value=unitPayload(data),supabase=await createClient();
    const{error}=await supabase.rpc("create_unit_with_history",{p_organization_id:context.activeMembership.organizationId,p_property_id:propertyId,p_unit_number:value.unitNumber,p_unit_type:value.unitType,p_bedrooms:value.bedrooms,p_bathrooms:value.bathrooms,p_area_sqm:value.areaSqm,p_floor_number:value.floorNumber,p_status:value.status,p_current_annual_rent:value.currentAnnualRent,p_notes:value.notes??"",p_effective_date:getRiyadhToday()});
    if(error)finish(path,friendlyError(error,"تعذر إضافة الوحدة."),"error");
    revalidatePath("/dashboard");revalidatePath(`/properties/${propertyId}`);revalidatePath("/properties");
    const choice=submitChoice(data),destination=choice==="continue"?target(propertyId,"leases","new-tenant"):choice==="add-another"?target(propertyId,"units","new-unit"):target(propertyId,"units");
    finish(destination,"تمت إضافة الوحدة وربط سجل حالتها. ظهرت الآن ضمن العقار.");
  }catch(error){if(isRedirectSignal(error))throw error;finish(path,error instanceof Error?error.message:"راجع بيانات الوحدة.","error");}
}

export async function updateUnitAction(data:FormData) {
  const context=await requireCapability("properties:write"),propertyId=id(data,"propertyId"),unitId=id(data,"unitId"),path=target(propertyId,"units");
  try{
    const value=unitPayload(data),supabase=await createClient();
    const{error}=await supabase.rpc("update_unit_with_history",{p_organization_id:context.activeMembership.organizationId,p_property_id:propertyId,p_unit_id:unitId,p_unit_number:value.unitNumber,p_unit_type:value.unitType,p_bedrooms:value.bedrooms,p_bathrooms:value.bathrooms,p_area_sqm:value.areaSqm,p_floor_number:value.floorNumber,p_status:value.status,p_current_annual_rent:value.currentAnnualRent,p_notes:value.notes??"",p_effective_date:getRiyadhToday()});
    if(error)finish(path,friendlyError(error,"تعذر تحديث الوحدة."),"error");
    revalidatePath("/dashboard");revalidatePath(`/properties/${propertyId}`);revalidatePath("/properties");
    finish(path,"تم حفظ الوحدة وتحديث تاريخ حالتها.");
  }catch(error){if(isRedirectSignal(error))throw error;finish(path,error instanceof Error?error.message:"راجع بيانات الوحدة.","error");}
}

export async function deleteUnitAction(data:FormData) {
  const context=await requireCapability("properties:delete"),propertyId=id(data,"propertyId"),unitId=id(data,"unitId"),path=target(propertyId,"units"),supabase=await createClient();
  const{data:lease}=await supabase.from("leases").select("id").eq("organization_id",context.activeMembership.organizationId).eq("unit_id",unitId).in("status",["draft","active"]).is("deleted_at",null).limit(1).maybeSingle();
  if(lease)finish(path,"لا يمكن حذف وحدة مرتبطة بعقد قائم.","error");
  const{error}=await supabase.from("units").update({deleted_at:new Date().toISOString()}).eq("organization_id",context.activeMembership.organizationId).eq("property_id",propertyId).eq("id",unitId).is("deleted_at",null);
  if(error)finish(path,"تعذر حذف الوحدة.","error");
  const today=getRiyadhToday();
  const{data:period}=await supabase.from("unit_status_periods").select("id, start_date").eq("organization_id",context.activeMembership.organizationId).eq("unit_id",unitId).is("end_date",null).maybeSingle();
  if(period){if(period.start_date<today)await supabase.from("unit_status_periods").update({end_date:new Date(`${today}T00:00:00Z`).toISOString().slice(0,10)}).eq("id",period.id);else await supabase.from("unit_status_periods").delete().eq("id",period.id);}
  revalidatePath("/dashboard");revalidatePath(`/properties/${propertyId}`);revalidatePath("/properties");
  finish(path,"تم حذف الوحدة منطقيًا.");
}

export async function createTenantAction(data:FormData) {
  const context=await requireCapability("leases:write"),propertyId=id(data,"propertyId"),path=target(propertyId,"leases","new-tenant"),fullName=text(data,"fullName",120);
  if(fullName.length<3)finish(path,"اكتب اسم المستأجر كاملًا.","error");
  const email=optionalText(data,"email",160);if(email&&!isValidEmail(email))finish(path,"البريد الإلكتروني للمستأجر غير صحيح.","error");
  const supabase=await createClient();
  const{error}=await supabase.from("tenants").insert({organization_id:context.activeMembership.organizationId,full_name:fullName,phone:optionalText(data,"phone",30),email,national_id_reference:optionalText(data,"nationalIdReference",60),notes:optionalText(data,"notes",500)});
  if(error)finish(path,friendlyError(error,"تعذر إضافة المستأجر."),"error");
  revalidatePath(`/properties/${propertyId}`);
  finish(submitChoice(data)==="continue"?target(propertyId,"leases","new-lease"):target(propertyId,"leases"),"تمت إضافة المستأجر، ويمكن إنشاء العقد الآن أو لاحقًا.");
}

export async function createLeaseAction(data:FormData) {
  const context=await requireCapability("leases:write"),propertyId=id(data,"propertyId"),path=target(propertyId,"leases","new-lease");
  try{
    const unitId=id(data,"unitId"),tenantId=id(data,"tenantId"),contractNumber=text(data,"contractNumber",80),startDate=text(data,"startDate",10),endDate=text(data,"endDate",10),annualRent=number(data,"annualRent",{min:.01})!,frequency=text(data,"paymentFrequency",30) as PaymentFrequency,customInstallments=integer(data,"customInstallments",{min:1,max:24,optional:true}),securityDeposit=number(data,"securityDeposit",{optional:true})??0,gracePeriodDays=integer(data,"gracePeriodDays",{max:365,optional:true})??0;
    if(!contractNumber||!paymentFrequencies.includes(frequency))throw new Error("راجع رقم العقد ودورية الدفع.");
    const schedule=generatePaymentSchedule(customInstallments===null?{startDate,endDate,annualRent,frequency}:{startDate,endDate,annualRent,frequency,customInstallments}),supabase=await createClient();
    const{error}=await supabase.rpc("create_lease_with_schedule",{p_organization_id:context.activeMembership.organizationId,p_property_id:propertyId,p_unit_id:unitId,p_tenant_id:tenantId,p_contract_number:contractNumber,p_start_date:startDate,p_end_date:endDate,p_annual_rent:annualRent,p_payment_frequency:frequency,p_security_deposit:securityDeposit,p_grace_period_days:gracePeriodDays,p_status:"active",p_schedule:schedule,p_effective_date:getRiyadhToday()});
    if(error)finish(path,friendlyError(error,"تعذر إنشاء العقد وجدول الدفعات."),"error");
    revalidatePath("/dashboard");revalidatePath(`/properties/${propertyId}`);revalidatePath("/properties");
    finish(submitChoice(data)==="continue"?target(propertyId,"payments"):target(propertyId,"leases"),`تم إنشاء العقد وجدول من ${schedule.length} دفعة، وانعكس على العقار.`);
  }catch(error){if(isRedirectSignal(error))throw error;finish(path,error instanceof Error?error.message:"راجع بيانات العقد.","error");}
}

export async function updateLeaseAction(data:FormData) {
  const context=await requireAccessContext(),propertyId=id(data,"propertyId"),leaseId=id(data,"leaseId"),path=target(propertyId,"leases");
  if(!can(context.activeMembership.role,"leases:write")&&!can(context.activeMembership.role,"leases:financial-update"))finish(path,"ليس لديك صلاحية تعديل العقد.","error");
  try{
    const securityDeposit=number(data,"securityDeposit",{optional:true})??0,gracePeriodDays=integer(data,"gracePeriodDays",{max:365,optional:true})??0,supabase=await createClient();
    const update:Record<string,string|number>={security_deposit:securityDeposit,grace_period_days:gracePeriodDays};
    if(can(context.activeMembership.role,"leases:write")){const contractNumber=text(data,"contractNumber",80);if(!contractNumber)throw new Error("رقم العقد مطلوب.");update.contract_number=contractNumber;}
    const{error}=await supabase.from("leases").update(update).eq("organization_id",context.activeMembership.organizationId).eq("property_id",propertyId).eq("id",leaseId).is("deleted_at",null);
    if(error)finish(path,friendlyError(error,"تعذر تعديل العقد."),"error");
    revalidatePath(`/properties/${propertyId}`);
    finish(path,"تم حفظ تعديلات العقد.");
  }catch(error){if(isRedirectSignal(error))throw error;finish(path,error instanceof Error?error.message:"راجع بيانات العقد.","error");}
}

export async function terminateLeaseAction(data:FormData) {
  const context=await requireCapability("leases:write"),propertyId=id(data,"propertyId"),leaseId=id(data,"leaseId"),path=target(propertyId,"leases"),supabase=await createClient();
  const{error}=await supabase.rpc("terminate_lease",{p_organization_id:context.activeMembership.organizationId,p_lease_id:leaseId,p_effective_date:getRiyadhToday()});
  if(error)finish(path,friendlyError(error,"تعذر إنهاء العقد."),"error");
  revalidatePath("/dashboard");revalidatePath(`/properties/${propertyId}`);revalidatePath("/properties");
  finish(path,"تم إنهاء العقد وإيقاف الاستحقاقات المستقبلية.");
}
