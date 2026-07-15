import { NextResponse,type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config.ts";
import { sanitizeNextPath } from "@/lib/auth/navigation.ts";
import { createClient } from "@/lib/supabase/server.ts";
export async function GET(request:NextRequest){const url=new URL(request.url),code=url.searchParams.get("code"),next=sanitizeNextPath(url.searchParams.get("next"));if(!getSupabasePublicConfig())return NextResponse.redirect(new URL("/login?error=configuration",url.origin));if(code){const s=await createClient();const{error}=await s.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(next,url.origin));}return NextResponse.redirect(new URL("/login?error=confirmation",url.origin));}
