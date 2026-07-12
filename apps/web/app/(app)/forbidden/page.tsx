import { ForbiddenAction, SystemState } from "@/components/system/system-state";

export default function ForbiddenPage() {
  return <SystemState kind="forbidden" action={<ForbiddenAction />} />;
}
