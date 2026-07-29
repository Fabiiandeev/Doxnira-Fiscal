import { marketingJsonLd } from "@/helpers/marketing-metadata";

export default function MarketingJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(marketingJsonLd) }}
    />
  );
}
