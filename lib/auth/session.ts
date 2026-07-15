import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server.ts";
import { can,isOrganizationRole,type Capability,type OrganizationRole } from "./permissions.ts";
export const ACTIVE_ORGANIZATION_COOKIE="aqarpro-active-organization";
export interface OrganizationMembership{id:string;organizationId:string;organizationName:string;role:OrganizationRole}
export interface AccessContext{user:User;memberships:OrganizationMembership[];activeMembership:OrganizationMembership}
export async function getCurrentUser(){const s=await createClient();const {data:{user}}=await s.auth.getUser();return user;}
export async function requireUser(){const user=await getCurrentUser();if(!user)redirect("/login");return user;}
export async function getMemberships(userId:string){
  const s=await createClient();const {data:members,error}=await s.from("organization_members").select("id, organization_id, user_id, role").eq("user_id",userId);
  if(error)throw new Error("تعذر قراءة عضويات المنشآت.");if(!members?.length)return [];
  const {data:orgs,error:orgError}=await s.from("organizations").select("id, name").in("id",members.map(m=>m.organization_id));
  if(orgError)throw new Error("تعذر قراءة المنشآت.");const names=new Map((orgs??[]).map(o=>[o.id,o.name]));
  return members.flatMap(m=>isOrganizationRole(m.role)&&names.has(m.organization_id)?[{id:m.id,organizationId:m.organization_id,organizationName:names.get(m.organization_id)!,role:m.role}]:[]) as OrganizationMembership[];
}
export async function requireAccessContext():Promise<AccessContext>{const user=await requireUser(),memberships=await getMemberships(user.id),fallbackMembership=memberships[0];if(!fallbackMembership)redirect("/onboarding");const selected=(await cookies()).get(ACTIVE_ORGANIZATION_COOKIE)?.value;const activeMembership=memberships.find(m=>m.organizationId===selected)??fallbackMembership;return{user,memberships,activeMembership};}
export async function requireCapability(capability:Capability){const context=await requireAccessContext();if(!can(context.activeMembership.role,capability))redirect("/access-denied");return context;}
