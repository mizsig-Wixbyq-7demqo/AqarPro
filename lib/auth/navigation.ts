const protectedPrefixes=["/dashboard","/properties","/payments","/expenses","/market-benchmarks","/score-history","/onboarding","/access-denied"];
export const isProtectedPath=(path:string)=>protectedPrefixes.some(prefix=>path===prefix||path.startsWith(`${prefix}/`));
const INTERNAL_ORIGIN="https://aqarpro.invalid";
function decodesToUnsafePath(value:string){
  let decoded=value;
  for(let pass=0;pass<4;pass+=1){
    if(decoded.startsWith("//")||decoded.includes("\\")||/[\u0000-\u001f\u007f]/u.test(decoded))return true;
    try{const next=decodeURIComponent(decoded);if(next===decoded)break;decoded=next;}catch{return true;}
  }
  return decoded.startsWith("//")||decoded.includes("\\")||/[\u0000-\u001f\u007f]/u.test(decoded);
}
export function sanitizeInternalPath(value:FormDataEntryValue|null|undefined,fallback="/dashboard"){
  if(typeof value!=="string"||value.length>512||value!==value.trim()||!value.startsWith("/")||decodesToUnsafePath(value))return fallback;
  try{const parsed=new URL(value,INTERNAL_ORIGIN);if(parsed.origin!==INTERNAL_ORIGIN)return fallback;return `${parsed.pathname}${parsed.search}`;}catch{return fallback;}
}
export const sanitizeNextPath=(value:FormDataEntryValue|null|undefined)=>sanitizeInternalPath(value,"/dashboard");
export const resolvePostAuthPath=(count:number,requested="/dashboard")=>count>0?requested:"/onboarding";
