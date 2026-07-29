export type FiscalEmissionKind="nfce"|"nfse";
export type PreparedDocument={id:string;status:string;payload:Record<string,unknown>;validation:{valid:boolean;issues:string[];total?:number;iss?:number}|null;createdAt:string;updatedAt:string};
