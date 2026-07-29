import type { Metadata } from "next";

import { marketingCopy } from "./marketing-copy";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://doxnira.com.br";

const siteName = "Doxnira Fiscal";

export const marketingMetadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "Doxnira Fiscal | Gestão Fiscal Inteligente",
  description:
    "Automatize sua operação fiscal, centralize documentos, reduza erros e conecte sua empresa ao contador com inteligência fiscal.",
  alternates: { canonical: baseUrl },
  applicationName: siteName,
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName,
    title: "Doxnira Fiscal | Gestão Fiscal Inteligente",
    description:
      "Automatize sua operação fiscal, centralize documentos, reduza erros e conecte sua empresa ao contador com inteligência fiscal.",
    url: baseUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Doxnira Fiscal",
    description:
      "Automatize sua operação fiscal, centralize documentos e reduza erros com inteligência fiscal.",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export const marketingJsonLd: Record<string, unknown>[] = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Doxnira Fiscal",
    url: baseUrl,
    description: marketingCopy.brand.tagline,
    sameAs: [],
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Doxnira Fiscal",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: baseUrl,
    description: marketingCopy.brand.secondary,
    offers: { "@type": "Offer", priceCurrency: "BRL", availability: "https://schema.org/InStock" },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: marketingCopy.faq.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  },
];

export const robotsContent = `User-agent: *
Allow: /

Disallow:
Allow: /sitemap.xml

Sitemap: ${baseUrl}/sitemap.xml
`;

export const sitemapEntries = [
  { url: baseUrl, priority: 1, changefreq: "weekly" },
];
