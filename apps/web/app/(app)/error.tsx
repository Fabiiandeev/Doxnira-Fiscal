"use client";

import { RetryButton, SystemState } from "@/components/system/system-state";

export default function AppErrorPage({ reset }: { reset: () => void }) {
  return <SystemState kind="error" action={<RetryButton onRetry={reset} />} />;
}
