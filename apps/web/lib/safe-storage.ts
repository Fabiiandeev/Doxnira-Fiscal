import { getBrowserLocalStorage } from "@/lib/browser-storage";

function getSafeStorage() {
  return getBrowserLocalStorage();
}

export function safeParseStorage<T>(key: string, fallback: T): T {
  const storage = getSafeStorage();
  if (!storage) return fallback;

  const raw = storage.getItem(key);

  if (!raw || raw === "undefined" || raw === "null") {
    storage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    storage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
}

export function setStorage<T>(key: string, data: T): void {
  getSafeStorage()?.setItem(key, JSON.stringify(data));
}

const MOCK_KEYS = [
  "ns-fiscal-autopilot-data",
  "ns-fiscal-score",
  "fiscal-calendar",
  "ns-fiscal-radar",
  "ns-fiscal-inbox",
  "ns-fiscal-maturity",
  "ns-nfse-national",
  "ns-inventory-incoming",
  "ns-segment-packages",
  "ns-onboarding-fiscal",
  "ns-fiscal-ai-conversations",
];

export function cleanStaleMockStorage(): void {
  const storage = getSafeStorage();
  if (!storage) return;
  for (const key of MOCK_KEYS) {
    const raw = storage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || (typeof parsed === "object" && Object.keys(parsed).length === 0)) {
        storage.removeItem(key);
      }
    } catch {
      storage.removeItem(key);
    }
  }
}
