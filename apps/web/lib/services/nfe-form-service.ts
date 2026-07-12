import type { NfeDetailActionResponse } from "@/lib/nfe-types";
import {
  createNfeDraft,
  deleteNfeDraft,
  getNfe,
  patchNfe,
  updateNfe,
} from "@/lib/services/nfe-service";

export const nfeFormService = {
  createDraft: createNfeDraft,
  getDraft: getNfe,
  saveDraft: updateNfe,
  patchDraft: patchNfe,
  deleteDraft: deleteNfeDraft,
};

export function saveNfeDraft(nfeId: string, payload: Record<string, unknown>): Promise<NfeDetailActionResponse> {
  return updateNfe(nfeId, payload);
}
