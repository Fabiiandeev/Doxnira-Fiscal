import { safeParseStorage, setStorage } from "@/lib/safe-storage";
import type { SegmentPackage } from "@/lib/fiscal-types";

const STORAGE_KEY = "ns-segment-packages";

function getStored(): SegmentPackage[] {
  return safeParseStorage<SegmentPackage[]>(STORAGE_KEY, []);
}

function setStored(data: SegmentPackage[]) {
  setStorage(STORAGE_KEY, data);
}

export async function getSegmentPackages(): Promise<SegmentPackage[]> {
  await new Promise(res => setTimeout(res, 200));
  return getStored();
}

export async function applySegmentPackage(packageId: string, companyId: string): Promise<{ success: boolean; packageId: string; companyId: string }> {
  await new Promise(res => setTimeout(res, 300));
  return { success: true, packageId, companyId };
}

export async function copyRulesBetweenCompanies(fromCompanyId: string, toCompanyId: string): Promise<{ success: boolean; fromCompanyId: string; toCompanyId: string }> {
  await new Promise(res => setTimeout(res, 200));
  return { success: true, fromCompanyId, toCompanyId };
}

export async function createCustomPackage(payload: Omit<SegmentPackage, "id">): Promise<SegmentPackage> {
  await new Promise(res => setTimeout(res, 300));
  const data = getStored();
  const created: SegmentPackage = {
    id: "pkg-" + Date.now(),
    ...payload,
  };
  data.push(created);
  setStored(data);
  return created;
}
