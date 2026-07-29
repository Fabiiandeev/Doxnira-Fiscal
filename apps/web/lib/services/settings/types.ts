export type SettingsKind = "overview"|"company"|"fiscal"|"certificate"|"integrations"|"users"|"security";
export type IntegrationSetting = { provider:string; module:string; status:string; configured:boolean; lastCheckAt?:string; lastSyncAt?:string; lastError?:string; environment?:string; actions:string[] };
export type AuditItem = { id:string; action:string; entityType?:string; createdAt:string; ipAddress?:string; userAgent?:string; metadata?:unknown; user?:{name:string;email:string} };
