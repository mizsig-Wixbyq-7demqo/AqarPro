export interface ActionState { status:"idle"|"error"|"success";message:string;fieldErrors?:Partial<Record<"fullName"|"email"|"password"|"organizationName",string>> }
export const initialActionState:ActionState={status:"idle",message:""};
