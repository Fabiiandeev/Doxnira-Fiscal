import { apiFetch, getCompanyId } from "@/lib/api";

function companyBase() {
  const companyId = getCompanyId();
  if (!companyId) throw new Error("Selecione uma empresa.");
  return `/companies/${companyId}`;
}

export type FiscalEstablishment = {
  id: string;
  code: string;
  legalName: string;
  tradeName?: string | null;
  taxId: string;
  stateRegistration?: string | null;
  cityCode?: string | null;
  city?: string | null;
  state?: string | null;
  isHeadquarters: boolean;
  isActive: boolean;
};

export type Driver = {
  id: string;
  name: string;
  cpf: string;
  phone?: string | null;
  license?: string | null;
  licenseType?: string | null;
  isActive: boolean;
};

export type FleetVehicle = {
  id: string;
  plate: string;
  plateState?: string | null;
  renavam?: string | null;
  rntrc?: string | null;
  isActive: boolean;
};

export type MdfeOperationalSetting = {
  id: string;
  establishmentId?: string | null;
  defaultVehicleId?: string | null;
  defaultDriverId?: string | null;
  defaultSeries: string;
  environment?: "homologation" | "production" | null;
  quickModeEnabled: boolean;
  rntrc?: string | null;
};

export const mdfeOperationalService = {
  establishments: () =>
    apiFetch<{ data: FiscalEstablishment[] }>(`${companyBase()}/establishments`),
  createEstablishment: (body: Record<string, unknown>) =>
    apiFetch<FiscalEstablishment>(`${companyBase()}/establishments`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateEstablishment: (id: string, body: Record<string, unknown>) =>
    apiFetch<FiscalEstablishment>(`${companyBase()}/establishments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  drivers: () => apiFetch<{ data: Driver[] }>(`${companyBase()}/drivers`),
  createDriver: (body: Record<string, unknown>) =>
    apiFetch<Driver>(`${companyBase()}/drivers`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateDriver: (id: string, body: Record<string, unknown>) =>
    apiFetch<Driver>(`${companyBase()}/drivers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteDriver: (id: string) =>
    apiFetch<{ deleted: boolean }>(`${companyBase()}/drivers/${id}`, { method: "DELETE" }),
  vehicles: () => apiFetch<{ data: FleetVehicle[] }>(`${companyBase()}/fleet-vehicles`),
  createVehicle: (body: Record<string, unknown>) =>
    apiFetch<FleetVehicle>(`${companyBase()}/fleet-vehicles`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateVehicle: (id: string, body: Record<string, unknown>) =>
    apiFetch<FleetVehicle>(`${companyBase()}/fleet-vehicles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteVehicle: (id: string) =>
    apiFetch<{ deleted: boolean }>(`${companyBase()}/fleet-vehicles/${id}`, { method: "DELETE" }),
  settings: () =>
    apiFetch<{ data: MdfeOperationalSetting[] }>(`${companyBase()}/mdfe-settings`),
  saveSettings: (body: Record<string, unknown>) =>
    apiFetch<MdfeOperationalSetting>(`${companyBase()}/mdfe-settings`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};
