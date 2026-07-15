export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && publishableKey ? { url, publishableKey } : null;
}
export function requireSupabasePublicConfig() {
  const config = getSupabasePublicConfig();
  if (!config) throw new Error("Supabase environment variables are missing.");
  return config;
}

export function getPublicSiteOrigin(){
  const value=process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if(!value)return process.env.NODE_ENV==="production"?null:"http://localhost:3000";
  try{
    const url=new URL(value);
    if(url.protocol!=="https:"&&url.protocol!=="http:")return null;
    if(process.env.NODE_ENV==="production"&&url.protocol!=="https:")return null;
    return url.origin;
  }catch{return null;}
}
