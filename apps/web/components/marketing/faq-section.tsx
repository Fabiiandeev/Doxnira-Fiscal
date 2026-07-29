"use client";

import { useState } from "react";

import { marketingCopy } from "@/helpers/marketing-copy";

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="faq"
      className="scroll-mt-24 bg-surface-muted px-4 py-16 md:px-8 md:py-24"
    >
      <div className="mx-auto max-w-3xl">
        <div className="max-w-xl">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-lime-strong">
            {marketingCopy.faq.eyebrow}
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.04em] text-ink md:text-[40px]">
            {marketingCopy.faq.title}
          </h2>
        </div>
        <dl className="mt-10 space-y-3">
          {marketingCopy.faq.items.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={item.question}
                role="heading"
                aria-level={3}
                className="rounded-2xl border border-line bg-surface shadow-soft"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${index}`}
                  id={`faq-question-${index}`}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between px-5 py-5 text-left text-sm font-extrabold text-ink transition-colors hover:text-lime-strong"
                >
                  <span>{item.question}</span>
                  <span
                    aria-hidden="true"
                    className={`ml-4 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line text-base font-bold transition-transform ${isOpen ? "rotate-45 bg-lime text-ink" : "text-subtle"}`}
                  >
                    +
                  </span>
                </button>
                <div
                  id={`faq-answer-${index}`}
                  role="region"
                  aria-labelledby={`faq-question-${index}`}
                  hidden={!isOpen}
                  className="overflow-hidden transition-all"
                >
                  <p className="border-t border-line px-5 pb-5 pt-0 text-sm leading-7 text-ink-soft">
                    {item.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}