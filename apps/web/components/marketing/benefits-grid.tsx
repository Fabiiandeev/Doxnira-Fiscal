"use client";
import Link from "next/link";
import { marketingCopy } from "@/helpers/marketing-copy";

export function BenefitsGrid() {
  return <section id="recursos" className="scroll-mt-24 bg-white px-4 py-3 md:px-8 md:py-4"><div className="mx-auto max-w-[1480px]"><ul id="funcionalidades" className="grid scroll-mt-24 gap-3 sm:grid-cols-2 lg:grid-cols-4">{marketingCopy.benefits.map((benefit) => <li key={benefit.id}><Link href={benefit.anchor} className="flex h-full items-center gap-2 rounded-xl border border-line bg-white p-2.5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-lime-strong/40 hover:shadow-card"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lime-soft text-xs font-extrabold text-ink" aria-hidden="true">{benefit.title.charAt(0)}</span><span><h3 className="text-[11px] font-extrabold tracking-tight text-ink">{benefit.title}</h3><p className="mt-0.5 text-[9px] leading-3 text-ink-soft">{benefit.description}</p></span></Link></li>)}</ul></div></section>;
}
