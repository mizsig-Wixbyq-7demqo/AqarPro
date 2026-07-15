export function NoticeBanner({success,error}:{success?:string|undefined;error?:string|undefined}){
  const message=error||success;if(!message)return null;
  return <div className={`notice-banner ${error?"error":"success"}`} role={error?"alert":"status"} aria-live={error?"assertive":"polite"}><b aria-hidden="true">{error?"!":"✓"}</b><span>{message}</span></div>;
}
