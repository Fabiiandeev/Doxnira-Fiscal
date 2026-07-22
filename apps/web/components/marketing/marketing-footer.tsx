"use client";

import Link from "next/link";

import { marketingCopy } from "@/helpers/marketing-copy";

export function MarketingFooter() {
  const { product, company, support, disclaimer } = marketingCopy.footer;

  return (
    <footer className="border-t border-line bg-surface-muted px-4 py-12 md:px-8 md:py-16">
      <div className="mx-auto max-w-[1400px] grid gap-6 md:grid-cols-4">
        <section>
          <h3 className="text-base font-extrabold tracking-tight text-ink mb-4">{product.title}</h3>
          <ul className="space-y-2 text-sm text-ink-soft">
            {product.links.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-base font-extrabold tracking-tight text-ink mb-4">{company.title}</h3>
          <ul className="space-y-2 text-sm text-ink-soft">
            {company.links.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-base font-extrabold tracking-tight text-ink mb-4">{support.title}</h3>
          <ul className="space-y-2 text-sm text-ink-soft">
            {support.links.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

      </div>

      <p className="mt-8 text-center text-xs text-ink-soft/80">
        {disclaimer}
      </p>
    </footer>
  );
}
