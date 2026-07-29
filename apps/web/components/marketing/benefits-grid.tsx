"use client";

import Link from "next/link";

import { marketingCopy } from "@/helpers/marketing-copy";

export function BenefitsGrid() {
  return (
    <section
      id="recursos"
      className="scroll-mt-24 bg-surface px-4 py-16 md:px-8 md:py-24"
    >
      <div className="mx-auto max-w-[1400px]">
        <div className="max-w-2xl">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-lime-strong">
            Recursos
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-ink md:text-[40px]">
            Tudo o que sua operação fiscal precisa em um só lugar
          </h2>
          <p className="mt-3 text-base text-ink-soft">
            Quatro pilares que conectam IA, documentos, contabilidade e segurança.
          </p>
        </div>
        <ul
          id="funcionalidades"
          className="mt-10 grid scroll-mt-24 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {marketingCopy.benefits.map((benefit) => (
            <li key={benefit.id}>
              <Link
                href={benefit.anchor}
                className="block h-full rounded-2xl border border-line bg-white p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-lime-strong/40 hover:shadow-card"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime-soft text-ink">
                  <span aria-hidden="true" className="text-base font-extrabold">
                    {benefit.title.charAt(0)}
                  </span>
                </span>
                <h3 className="mt-4 text-lg font-extrabold tracking-tight text-ink">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{benefit.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
