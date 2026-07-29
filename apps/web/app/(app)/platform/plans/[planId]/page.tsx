import { PlanForm } from "@/components/platform/plans/plan-form";
export default async function PlatformPlanPage({params}:{params:Promise<{planId:string}>}){const {planId}=await params;return <PlanForm planId={planId}/>;}
