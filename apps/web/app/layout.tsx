import type { Metadata } from "next";

import { Providers } from "@/components/providers";
import "./globals.css";

export const dynamic = "force-dynamic";

const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "NS Sistemas";
const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? "NS Fiscal Cloud";

export const metadata: Metadata = {
  title: {
    default: productName,
    template: `%s | ${productName}`,
  },
  description: `Central fiscal da ${companyName} para sincronização e gestão de NF-e.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

