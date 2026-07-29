"use client";
import { useQuery } from "@tanstack/react-query";
import { getOperationDashboard } from "./operation-dashboard-service";
export const useOperationDashboard = (query: string) => useQuery({ queryKey: ["operation", "dashboard", query], queryFn: () => getOperationDashboard(query) });
