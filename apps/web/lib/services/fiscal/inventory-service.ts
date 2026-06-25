
import { inventoryIncomingMock } from '@/lib/mocks/fiscal-mocks';
import type { InventoryIncomingItem } from '@/lib/fiscal-types';

const STORAGE_KEY = 'ns-inventory-incoming';

function getStored(): InventoryIncomingItem[] {
  if (typeof window === 'undefined') return inventoryIncomingMock;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(inventoryIncomingMock));
  return inventoryIncomingMock;
}

function setStored(data: InventoryIncomingItem[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

export async function getInventoryIncoming(filters?: { status?: string; documentId?: string; hasDivergence?: boolean }): Promise<InventoryIncomingItem[]> {
  await new Promise(resolve => setTimeout(resolve, 200));
  let data = getStored();
  
  if (filters?.status) {
    data = data.filter(item => item.status === filters.status);
  }
  if (filters?.documentId) {
    data = data.filter(item => item.documentId === filters.documentId);
  }
  if (filters?.hasDivergence !== undefined) {
    data = data.filter(item => item.hasDivergence === filters.hasDivergence);
  }
  
  return data;
}

export async function linkProduct(itemId: string, internalProductId: string, internalProductName: string): Promise<InventoryIncomingItem | null> {
  await new Promise(resolve => setTimeout(resolve, 200));
  const data = getStored();
  const index = data.findIndex(item => item.id === itemId);
  if (index === -1) return null;
  
  data[index] = { 
    ...data[index], 
    internalProductId, 
    internalProductName,
    isLinked: true,
    canAutoLaunch: !data[index].hasDivergence,
    status: data[index].hasDivergence ? 'BLOCKED' : 'LINKED'
  };
  setStored(data);
  return data[index];
}

export async function createProductFromXML(itemId: string, productData: { ncm: string; cest?: string; unit: string }): Promise<InventoryIncomingItem | null> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const data = getStored();
  const index = data.findIndex(item => item.id === itemId);
  if (index === -1) return null;
  
  const newProductId = 'prod-' + Date.now();
  data[index] = { 
    ...data[index], 
    internalProductId: newProductId,
    internalProductName: data[index].supplierProductName,
    ncm: productData.ncm,
    cest: productData.cest || '',
    unit: productData.unit,
    isLinked: true,
    canAutoLaunch: !data[index].hasDivergence,
    status: data[index].hasDivergence ? 'BLOCKED' : 'LINKED'
  };
  setStored(data);
  return data[index];
}

export async function configureConversion(itemId: string, conversionFactor: number, targetUnit: string): Promise<InventoryIncomingItem | null> {
  await new Promise(resolve => setTimeout(resolve, 200));
  const data = getStored();
  const index = data.findIndex(item => item.id === itemId);
  if (index === -1) return null;
  
  data[index] = { 
    ...data[index], 
    unit: targetUnit,
    quantity: Math.round(data[index].quantity * conversionFactor),
    hasDivergence: false,
    divergenceType: undefined,
    canAutoLaunch: true,
    status: 'LINKED'
  };
  setStored(data);
  return data[index];
}

export async function launchStock(itemId: string): Promise<InventoryIncomingItem | null> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const data = getStored();
  const index = data.findIndex(item => item.id === itemId);
  if (index === -1) return null;
  
  if (!data[index].canAutoLaunch) return null;
  
  data[index] = { 
    ...data[index], 
    status: 'LAUNCHED',
    launchedAt: new Date().toISOString()
  };
  setStored(data);
  return data[index];
}

export async function sendToAccountantReview(itemIds: string[]): Promise<{ success: number; failed: number }> {
  await new Promise(resolve => setTimeout(resolve, 200));
  const data = getStored();
  let success = 0;
  let failed = 0;
  
  for (const itemId of itemIds) {
    const index = data.findIndex(item => item.id === itemId);
    if (index !== -1) {
      data[index] = { ...data[index], status: 'SENT_TO_ACCOUNTANT' };
      success++;
    } else {
      failed++;
    }
  }
  
  setStored(data);
  return { success, failed };
}

export async function bulkLaunchStock(itemIds: string[]): Promise<{ success: number; failed: number }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const data = getStored();
  let success = 0;
  let failed = 0;
  
  for (const itemId of itemIds) {
    const index = data.findIndex(item => item.id === itemId);
    if (index !== -1 && data[index].canAutoLaunch) {
      data[index] = { ...data[index], status: 'LAUNCHED', launchedAt: new Date().toISOString() };
      success++;
    } else {
      failed++;
    }
  }
  
  setStored(data);
  return { success, failed };
}

