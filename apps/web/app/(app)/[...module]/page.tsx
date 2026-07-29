import { ModulePlaceholderView } from "@/components/modules/module-placeholder-view";
import { ModuleView, type ModuleName } from "@/components/modules/module-view";
import { IntelligenceView } from "@/components/intelligence/intelligence-view";

const modules = [
  "companies",
  "manifestations",
  "alerts",
  "reports",
  "users",
  "settings",
  "help",
  "guides",
  "requests",
] as const satisfies readonly ModuleName[];

export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string[] }>;
}) {
  const { module } = await params;
  const [firstSegment] = module;
  const intelligenceModules = {
    "fiscal-intelligence": "fiscal",
    "commerce-intelligence": "commerce",
    "doxnira-insights": "insights",
    "decision-center": "decisions",
    benchmark: "benchmark",
  } as const;

  if (module.length === 1 && firstSegment in intelligenceModules) {
    return <IntelligenceView kind={intelligenceModules[firstSegment as keyof typeof intelligenceModules]} />;
  }

  if (module.length === 1 && modules.includes(firstSegment as ModuleName)) {
    return <ModuleView module={firstSegment as ModuleName} />;
  }

  return <ModulePlaceholderView segments={module} />;
}
