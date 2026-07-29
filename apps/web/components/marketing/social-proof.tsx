import { marketingCopy } from "@/helpers/marketing-copy";

const LOGOS = ["Alfatech", "Cerrado Co.", "Vale Verde", "Prátika", "Nova Safra", "MinasTech"];

export function SocialProof() {
  return (
    <section className="border-y border-line bg-surface-muted px-4 py-10 md:px-8">
      <div className="mx-auto max-w-[1400px]">
        <p className="text-center text-xs font-extrabold uppercase tracking-[0.18em] text-ink-soft">
          {marketingCopy.socialProof.title}
        </p>
        <ul className="mt-6 grid grid-cols-2 items-center gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {LOGOS.map((name) => (
            <li
              key={name}
              className="flex items-center justify-center rounded-xl border border-line bg-white px-4 py-3 text-sm font-extrabold tracking-tight text-ink-soft/80"
              data-testid="social-proof-logo"
              aria-label={name}
            >
              {name}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-center text-[11px] font-medium text-subtle">
          {marketingCopy.socialProof.disclaimer}
        </p>
      </div>
    </section>
  );
}
