export const organizationRoles = ["owner","manager","accountant","viewer"] as const;
export type OrganizationRole = typeof organizationRoles[number];
export const capabilities = ["portfolio:read","properties:write","properties:delete","leases:write","leases:financial-update","finance:write","finance:delete","benchmarks:write","benchmarks:delete","members:manage","members:grant-owner","organization:update","organization:delete","audit:read","snapshots:create","snapshots:delete"] as const;
export type Capability = typeof capabilities[number];
export const roleLabels: Record<OrganizationRole,string> = { owner:"مالك",manager:"مدير",accountant:"محاسب",viewer:"مشاهد" };
export const roleCapabilities: Record<OrganizationRole,readonly Capability[]> = {
  owner: capabilities,
  manager:["portfolio:read","properties:write","leases:write","finance:write","finance:delete","benchmarks:write","members:manage","audit:read","snapshots:create"],
  accountant:["portfolio:read","leases:financial-update","finance:write"],
  viewer:["portfolio:read"],
};
export const isOrganizationRole = (value:string): value is OrganizationRole => organizationRoles.includes(value as OrganizationRole);
export const can = (role:OrganizationRole, capability:Capability) => roleCapabilities[role].includes(capability);
export function assertCan(role:OrganizationRole, capability:Capability) { if (!can(role,capability)) throw new Error("ليس لديك الصلاحية اللازمة لتنفيذ هذه العملية."); }
