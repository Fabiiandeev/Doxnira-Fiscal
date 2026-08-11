"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { marketingNavigation } from "@/helpers/marketing-navigation";
import { trackMarketingEvent } from "@/helpers/marketing-analytics";

const BODY_LOCK_CLASS = "marketing-menu-open";

export function MobileNav({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
}) {
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.classList.add(BODY_LOCK_CLASS);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
      } else if (event.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    closeButtonRef.current?.focus();
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove(BODY_LOCK_CLASS);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Menu de navegação"
    >
      <button
        type="button"
        aria-label="Fechar menu"
        onClick={() => setIsOpen(false)}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        tabIndex={-1}
      />
      <div
        ref={drawerRef}
        className="absolute right-0 top-0 flex h-full w-[88%] max-w-sm flex-col gap-2 overflow-y-auto bg-surface p-6 shadow-card"
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-extrabold tracking-tight text-ink">Menu</span>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Fechar menu"
            onClick={() => setIsOpen(false)}
            className="rounded-full p-2 text-ink hover:bg-muted"
          >
            ×
          </button>
        </div>
        <nav className="flex flex-col" aria-label="Navegação móvel">
          {marketingNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="rounded-lg px-3 py-3 text-sm font-semibold text-ink hover:bg-muted"
            >
              {item.title}
            </Link>
          ))}
        </nav>
        <div className="mt-4 flex flex-col gap-3">
          <Link
            href="/login"
            onClick={() => {
              trackMarketingEvent("marketing.login_clicked");
              setIsOpen(false);
            }}
            className="rounded-xl border border-line bg-white px-4 py-3 text-center text-sm font-bold text-ink"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            onClick={() => {
              trackMarketingEvent("marketing.signup_clicked");
              setIsOpen(false);
            }}
            className="rounded-xl bg-lime px-4 py-3 text-center text-sm font-bold text-ink"
          >
            Começar agora
          </Link>
        </div>
      </div>
    </div>
  );
}
