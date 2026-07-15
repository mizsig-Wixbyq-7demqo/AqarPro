import {roleLabels,type OrganizationRole} from "@/lib/auth/permissions.ts";
export function RoleBadge({role}:{role:OrganizationRole}){return <span className={`role-badge role-${role}`}>{roleLabels[role]}</span>}
