import type { Metadata } from "next";
import { cookies, headers } from "next/headers";

import { Providers } from "@/components/providers";
import type { SessionUser } from "@/lib/api";
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

const storageShimScript = `
(function () {
  try {
    if ("localStorage" in window && window.localStorage) return;
    var store = new Map();
    var storage = {
      get length() {
        return store.size;
      },
      getItem: function (key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem: function (key, value) {
        store.set(String(key), String(value));
      },
      removeItem: function (key) {
        store.delete(key);
      },
      clear: function () {
        store.clear();
      },
      key: function (index) {
        return Array.from(store.keys())[index] ?? null;
      },
    };
    var installed = false;
    try {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        enumerable: true,
        value: storage,
      });
      installed = true;
    } catch (defineError) {}
    if (!installed) {
      try {
        window.localStorage = storage;
        installed = true;
      } catch (assignError) {}
    }
    window.__nsLocalStorageShimInstalled = installed;
    window.__nsLocalStorageFallback = storage;
  } catch (error) {}
})();
`;

async function readBootstrapSession() {
  const headerStore = await headers();
  const headerToken = headerStore.get("x-ns-session-token");
  const headerUser = headerStore.get("x-ns-session-user");
  const headerCompanyId = headerStore.get("x-ns-session-company-id");

  if (headerToken) {
    let user: SessionUser | null = null;
    if (headerUser) {
      try {
        user = JSON.parse(headerUser) as SessionUser;
      } catch {
        user = null;
      }
    }

    return {
      token: headerToken,
      companyId: headerCompanyId,
      user,
    };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("ns-fiscal-token")?.value ?? null;
  const companyId = cookieStore.get("ns-fiscal-company-id")?.value ?? null;
  const userCookie = cookieStore.get("ns-fiscal-user")?.value ?? null;

  let user: SessionUser | null = null;
  if (userCookie) {
    try {
      user = JSON.parse(userCookie) as SessionUser;
    } catch {
      user = null;
    }
  }

  return { token, companyId, user };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialSession = await readBootstrapSession();

  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <head>
        <script dangerouslySetInnerHTML={{ __html: storageShimScript }} />
      </head>
      <body>
        <Providers initialSession={initialSession}>{children}</Providers>
      </body>
    </html>
  );
}
