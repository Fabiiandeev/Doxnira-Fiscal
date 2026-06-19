import { notFound } from "next/navigation";

import { ModuleView } from "@/components/modules/module-view";

const modules = [
  "companies",
  "manifestations",
  "alerts",
  "reports",
  "users",
  "settings",
  "help",
] as const;

export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  if (!modules.includes(module as (typeof modules)[number])) notFound();
  return <ModuleView module={module as (typeof modules)[number]} />;
}
