export function safeParseStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  const raw = localStorage.getItem(key);

  if (!raw || raw === "undefined" || raw === "null") {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
}

export function setStorage<T>(key: string, data: T): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, JSON.stringify(data));
  }
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
  if (typeof window === "undefined") return;
  for (const key of MOCK_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || (typeof parsed === "object" && Object.keys(parsed).length === 0)) {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }
}
