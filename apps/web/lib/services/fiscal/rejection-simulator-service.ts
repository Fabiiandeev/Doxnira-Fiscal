import type { RejectionSimulation } from "@/lib/fiscal-types";

export async function simulateRejection(documentData: { clientIE?: string; certificateValid?: boolean; [key: string]: unknown }): Promise<RejectionSimulation> {
  await new Promise(res => setTimeout(res, 500));

  const risks: RejectionSimulation["risks"] = [];
  let criticalBlocking = false;
  let canEmit = true;
  let rejectionChance = 0;

  if (!documentData.clientIE) {
    criticalBlocking = true;
    canEmit = false;
    rejectionChance += 40;
  }
  if (!documentData.certificateValid) {
    criticalBlocking = true;
    canEmit = false;
    rejectionChance += 30;
  }

  return {
    rejectionChance,
    risks,
    canEmit,
    criticalBlocking,
  };
}

export async function getRejectionRisks(): Promise<RejectionSimulation["risks"]> {
  await new Promise(res => setTimeout(res, 100));
  return [];
}
