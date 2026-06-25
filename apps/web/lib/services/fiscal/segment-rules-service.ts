
import { segmentRulesMock } from '@/lib/mocks/fiscal-mocks';
import type { SegmentPackage } from '@/lib/fiscal-types';

const STORAGE_KEY = 'ns-segment-rules';

function getStored(): SegmentPackage[] {
  if (typeof window === 'undefined') return segmentRulesMock;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(segmentRulesMock));
  return segmentRulesMock;
}

function setStored(data: SegmentPackage[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

export async function getSegmentPackages(): Promise<SegmentPackage[]> {
  await new Promise(res => setTimeout(res, 200));
  return getStored();
}

export async function getSegmentPackage(id: string): Promise<SegmentPackage | null> {
  await new Promise(res => setTimeout(res, 100));
  const data = getStored();
  return data.find(item => item.id === id) || null;
}

export async function applySegmentPackage(packageId: string, targetCompanyId: string): Promise<boolean> {
  await new Promise(res => setTimeout(res, 500));
  // Mock implementation - would apply rules to company
  console.log(Applying package  to company );
  return true;
}

export async function copyRulesBetweenCompanies(sourceCompanyId: string, targetCompanyId: string): Promise<boolean> {
  await new Promise(res => setTimeout(res, 500));
  console.log(Copying rules from  to );
  return true;
}

export async function createCustomPackage(data: Omit<SegmentPackage, 'id'>): Promise<SegmentPackage> {
  await new Promise(res => setTimeout(res, 300));
  const stored = getStored();
  const newPackage: SegmentPackage = {
    ...data,
    id: 'seg-' + Date.now()
  };
  setStored([...stored, newPackage]);
  return newPackage;
}

