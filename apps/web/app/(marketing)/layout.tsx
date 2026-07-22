import MarketingJsonLd from "@/components/marketing/marketing-json-ld";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingJsonLd />
      {children}
    </>
  );
}
