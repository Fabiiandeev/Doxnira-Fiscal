"use client";

import Link from "next/link";
import { useState } from "react";

import { MarketingLogo } from "./marketing-logo";
import { MobileNav } from "./mobile-nav";
import { marketingNavigation, marketingHeaderActions } from "@/helpers/marketing-navigation";
import { Button } from "@/components/ui/button";
import { trackMarketingEvent } from "@/helpers/marketing-analytics";

export function MarketingHeader() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 md:px-8">
        <Link href="/" aria-label="Doxnira Fiscal - página inicial">
          <MarketingLogo />
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Navegação principal">
          {marketingNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
            >
              {item.title}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button
            variant="ghost"
            size="sm"
            asChild
            onClick={() => trackMarketingEvent("marketing.login_clicked")}
          >
            <Link href={marketingHeaderActions.login.href}>{marketingHeaderActions.login.label}</Link>
          </Button>
          <Button
            variant="lime"
            size="sm"
            asChild
            onClick={() => trackMarketingEvent("marketing.signup_clicked")}
          >
            <Link href={marketingHeaderActions.signup.href}>
              {marketingHeaderActions.signup.label}
            </Link>
          </Button>
        </div>

        <button
          type="button"
          aria-label="Abrir menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-white text-ink md:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <MobileNav isOpen={isOpen} setIsOpen={setIsOpen} />
      </div>
    </header>
  );
}
