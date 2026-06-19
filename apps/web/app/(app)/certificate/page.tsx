import type { Metadata } from "next";

import { CertificateView } from "@/components/certificate/certificate-view";

export const metadata: Metadata = { title: "Certificado digital" };

export default function CertificatePage() {
  return <CertificateView />;
}
