import { marketingCopy } from "@/helpers/marketing-copy";

const LOGOS = ["Alfatech", "Cerrado Co.", "Vale Verde", "Prátika", "Nova Safra", "MinasTech"];

export function SocialProof() {
  return (
    <section className="border-y border-line bg-white px-4 py-2 md:px-8">
      <div className="mx-auto max-w-[1400px]">
        <p className="text-center text-[11px] font-extrabold tracking-wide text-ink-soft">
          {marketingCopy.socialProof.title}
        </p>
        <ul className="mt-2 grid grid-cols-2 items-center gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {LOGOS.map((name) => (
            <li
              key={name}
              className="flex items-center justify-center px-3 py-1 text-xs font-extrabold uppercase tracking-[0.12em] text-ink-soft/70"
              data-testid="social-proof-logo"
              aria-label={name}
            >
              {name}
            </li>
          ))}
        </ul>
        <p className="sr-only">
          {marketingCopy.socialProof.disclaimer}
        </p>
      </div>
    </section>
  );
}
