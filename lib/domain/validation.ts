const ISO_DATE_PATTERN=/^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN=/^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export function isValidIsoDate(value:string){
  if(!ISO_DATE_PATTERN.test(value))return false;
  const year=Number(value.slice(0,4)),month=Number(value.slice(5,7)),day=Number(value.slice(8,10));
  const date=new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}

export const isUuid=(value:string)=>UUID_PATTERN.test(value);
export const isValidEmail=(value:string)=>value.length<=254&&EMAIL_PATTERN.test(value);
