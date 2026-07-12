import { SystemState } from "@/components/system/system-state";

export default function NotFoundPage() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-10">
      <SystemState kind="not-found" />
    </main>
  );
}
