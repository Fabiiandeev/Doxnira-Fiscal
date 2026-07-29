import type { MdfePayload } from "@/lib/mdfe-types";

export type MdfeStepProps = {
  value: MdfePayload;
  onChange: (patch: MdfePayload) => void;
};
