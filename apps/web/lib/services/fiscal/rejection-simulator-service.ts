
import { rejectionSimulatorMock } from '@/lib/mocks/fiscal-mocks';
import type { RejectionSimulation } from '@/lib/fiscal-types';

export async function simulateRejection(documentData: { clientIE?: string; certificateValid?: boolean; [key: string]: unknown }): Promise<RejectionSimulation> {
  await new Promise(res => setTimeout(res, 500));
  
  // Simulate analysis based on document data
  const risks = [...rejectionSimulatorMock.risks];
  let criticalBlocking = false;
  let canEmit = true;
  
  // Check for critical issues in document data
  if (!documentData.clientIE) {
    criticalBlocking = true;
    canEmit = false;
  }
  if (!documentData.certificateValid) {
    criticalBlocking = true;
    canEmit = false;
  }
  
  return {
    rejectionChance: rejectionSimulatorMock.rejectionChance + (criticalBlocking ? 50 : 0),
    risks,
    canEmit,
    criticalBlocking
  };
}

export async function getRejectionRisks(): Promise<RejectionSimulation['risks']> {
  await new Promise(res => setTimeout(res, 100));
  return rejectionSimulatorMock.risks;
}

