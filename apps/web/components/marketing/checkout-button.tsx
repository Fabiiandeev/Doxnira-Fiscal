"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { resolveCheckoutUrl, isEnterprisePlan, ENTERPRISE_CONTACT_URL } from "@/helpers/checkout-links";
import { isSafeCheckoutUrl } from "@/helpers/checkout-url-validator";
import { trackMarketingEvent } from "@/helpers/marketing-analytics";
import { useContactDialog } from "./contact-dialog";
import type { BillingCycle } from "@/helpers/checkout-links";

type Intent = "lead" | "contact" | "enterprise";

const PLAN_LABEL_BY_CODE: Record<string, string> = {
  STARTER: "Starter",
  PROFESSIONAL: "Professional",
  BUSINESS: "Business",
  COMPANY: "Empresa",
};

const PLAN_CTA_BY_CODE: Record<string, string> = {
  STARTER: "Começar com Starter",
  PROFESSIONAL: "Escolher Professional",
  BUSINESS: "Escolher Business",
};

export function CheckoutButton({
  planCode,
  billingCycle,
  customPricing,
}: {
  planCode: string;
  billingCycle: BillingCycle;
  customPricing: boolean;
}) {
  const { openContact } = useContactDialog();

  if (isEnterprisePlan(planCode) || customPricing) {
    const href = ENTERPRISE_CONTACT_URL ?? null;
    const safe = isSafeCheckoutUrl(href);
    return (
      <Button
        asChild={!safe}
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => trackMarketingEvent("marketing.enterprise_contact_clicked", { planCode })}
      >
        {safe ? (
          <Link href={href as string} target="_blank" rel="noopener noreferrer">
            Falar com um especialista
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => openContact({ planCode, intent: "enterprise" as Intent })}
          >
            Falar com um especialista
          </button>
        )}
      </Button>
    );
  }

  const rawUrl = resolveCheckoutUrl(planCode, billingCycle);
  const safe = isSafeCheckoutUrl(rawUrl);

  if (!safe) {
    // fallback: direciona para contato comercial com plano na query.
    return (
      <Button
        variant="lime"
        size="lg"
        className="w-full"
        onClick={() => {
          trackMarketingEvent("marketing.plan_selected", { planCode, billingCycle });
          openContact({ planCode, intent: "lead" as Intent });
        }}
      >
        {PLAN_CTA_BY_CODE[planCode] ?? "Falar com nosso time"}
      </Button>
    );
  }

  return (
    <Button
      asChild
      variant="lime"
      size="lg"
      className="w-full"
      onClick={() => trackMarketingEvent("marketing.plan_selected", { planCode, billingCycle })}
    >
      <Link href={rawUrl as string} target="_blank" rel="noopener noreferrer">
        Assinar agora
      </Link>
    </Button>
  );
}

export { PLAN_LABEL_BY_CODE };
