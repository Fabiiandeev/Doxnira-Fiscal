import type { Metadata } from "next";

import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingHero } from "@/components/marketing/marketing-hero";
import { SocialProof } from "@/components/marketing/social-proof";
import { BenefitsGrid } from "@/components/marketing/benefits-grid";
import { PlansSection } from "@/components/marketing/plans-section";
import { CommerceSection } from "@/components/marketing/commerce-section";
import { AccountantPortalSection } from "@/components/marketing/accountant-portal-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCta } from "@/components/marketing/final-cta";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { ContactDialogProvider } from "@/components/marketing/contact-dialog";
import { marketingMetadata } from "@/helpers/marketing-metadata";

export const metadata: Metadata = marketingMetadata;

export default function MarketingLandingPage() {
  return (
    <ContactDialogProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Pular para o conteúdo
      </a>
      <MarketingHeader />
      <main id="main" className="flex flex-col">
        <MarketingHero />
        <SocialProof />
        <BenefitsGrid />
        <PlansSection />
        <CommerceSection />
        <AccountantPortalSection />
        <FaqSection />
        <FinalCta />
      </main>
      <MarketingFooter />
    </ContactDialogProvider>
  );
}
