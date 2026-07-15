import { createServerClient } from "@supabase/ssr";
import { NextResponse,type NextRequest } from "next/server";
import { isProtectedPath } from "@/lib/auth/navigation.ts";
import { getSupabasePublicConfig } from "./config.ts";
function protectResponse(response:NextResponse,request:NextRequest){
  response.headers.set("Content-Security-Policy","base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  response.headers.set("Permissions-Policy","camera=(), microphone=(), geolocation=(), payment=()");
  response.headers.set("Referrer-Policy","strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options","nosniff");
  response.headers.set("X-Frame-Options","DENY");
  if(isProtectedPath(request.nextUrl.pathname))response.headers.set("Cache-Control","private, no-store, max-age=0");
  if(process.env.NODE_ENV==="production")response.headers.set("Strict-Transport-Security","max-age=63072000; includeSubDomains");
  return response;
}
export async function updateSession(request:NextRequest) {
  const config=getSupabasePublicConfig(); if(!config) return protectResponse(NextResponse.next({request}),request);
  let response=NextResponse.next({request});
  const supabase=createServerClient(config.url,config.publishableKey,{cookies:{
    getAll:()=>request.cookies.getAll(),
    setAll(items){items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});items.forEach(({name,value,options})=>response.cookies.set(name,value,options));},
  }});
  const {data:{user}}=await supabase.auth.getUser();
  if(!user&&isProtectedPath(request.nextUrl.pathname)){const url=request.nextUrl.clone();url.pathname="/login";url.searchParams.set("next",`${request.nextUrl.pathname}${request.nextUrl.search}`);return protectResponse(NextResponse.redirect(url),request);}
  return protectResponse(response,request);
}
