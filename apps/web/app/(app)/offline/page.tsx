import { RetryButton, SystemState } from "@/components/system/system-state";

export default function OfflinePage() {
  return <SystemState kind="offline" action={<RetryButton />} />;
}
