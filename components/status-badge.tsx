const unitLabels={occupied:"مؤجرة",vacant:"شاغرة",maintenance:"تحت الصيانة",inactive:"غير نشطة"} as const;
const leaseLabels={draft:"مسودة",active:"نشط",expired:"منتهي",terminated:"منهى",cancelled:"ملغي"} as const;
export function UnitStatusBadge({status}:{status:keyof typeof unitLabels}){return <span className={`status-badge status-${status}`}>{unitLabels[status]}</span>}
export function LeaseStatusBadge({status}:{status:keyof typeof leaseLabels}){return <span className={`status-badge status-${status}`}>{leaseLabels[status]}</span>}
