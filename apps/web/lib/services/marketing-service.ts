import { apiFetch } from "@/lib/api";

export type MarketingBillingCycle = "MONTHLY" | "ANNUAL";

export type MarketingPlanPrice = {
  billingCycle: MarketingBillingCycle;
  amountCents: number;
  currency: string;
};

export type MarketingPlan = {
  code: string;
  name: string;
  description: string | null;
  displayOrder: number;
  prices: MarketingPlanPrice[];
  highlights: string[];
  recommended: boolean;
  customPricing: boolean;
  checkoutAvailable: boolean;
};

export type MarketingFeatureStatus = "AVAILABLE" | "BETA" | "PLANNED" | "FUTURE";

export type MarketingFeature = {
  code: string;
  name: string;
  description: string | null;
  status: MarketingFeatureStatus;
  statusLabel: string;
};

export type LeadInterest =
  | "PLAN_INFO"
  | "DEMO"
  | "INTEGRATION"
  | "COMMERCE"
  | "PORTAL_CONTABIL"
  | "SUPPORT"
  | "OTHER";

export type LeadInput = {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  document?: string | null;
  interest: LeadInterest;
  planCode?: string | null;
  message?: string | null;
  source?: string | null;
  consent: boolean;
  // honeypot invisível: deve permanecer vazio
  website?: string | null;
};

export type LeadResult = {
  id: string;
  status: string;
  requestId: string | null;
};

export type ContactInput = {
  subject: string;
  message: string;
  companyName: string;
  contact: string;
  planCode?: string | null;
  source?: string | null;
  consent: boolean;
};

export type MarketingStatus = {
  status: "ok" | "degraded" | "down";
  services: Record<string, { status: string; detail?: string }>;
  requestId: string | null;
};

const scope = "/public/marketing";

export const marketingService = {
  plans: () => apiFetch<{ plans: MarketingPlan[] }>(`${scope}/plans`),
  features: () => apiFetch<{ features: MarketingFeature[] }>(`${scope}/features`),
  status: () => apiFetch<MarketingStatus>(`${scope}/status`),
  submitLead: (input: LeadInput) =>
    apiFetch<LeadResult>(`${scope}/leads`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  submitContact: (input: ContactInput) =>
    apiFetch<LeadResult>(`${scope}/contact`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
