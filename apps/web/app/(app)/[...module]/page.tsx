import { ModulePlaceholderView } from "@/components/modules/module-placeholder-view";
import { ModuleView, type ModuleName } from "@/components/modules/module-view";

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

  if (module.length === 1 && modules.includes(firstSegment as ModuleName)) {
    return <ModuleView module={firstSegment as ModuleName} />;
  }

  return <ModulePlaceholderView segments={module} />;
}
