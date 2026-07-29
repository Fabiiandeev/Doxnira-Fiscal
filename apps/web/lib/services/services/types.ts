export type ServiceCatalog = {
  id: string; code: string; description: string; municipalCode: string; nationalCode: string;
  serviceListItem: string | null; municipality: string; municipalityIbgeCode: string; cnae: string | null;
  issRate: number; issWithheld: boolean; operationNature: string | null; enforceability: string | null;
  incidenceLocation: string | null; inssRate: number; irRate: number; csllRate: number; pisRate: number;
  cofinsRate: number; otherWithholdingRate: number; defaultValue: number; active: boolean;
};
export type ServiceInput = Omit<ServiceCatalog, "id">;
