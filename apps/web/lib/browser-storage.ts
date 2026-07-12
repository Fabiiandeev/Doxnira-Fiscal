type BrowserStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "clear" | "key"> & {
  readonly length: number;
};

type WindowWithStorageFallback = Window & {
  __nsLocalStorageFallback?: BrowserStorageLike;
};

export function getBrowserLocalStorage(): BrowserStorageLike | null {
  if (typeof window === "undefined") return null;

  try {
    const storage = window.localStorage;
    if (storage && typeof storage.getItem === "function") return storage;
  } catch {
    // Ignore browsers that expose storage as unavailable.
  }

  const fallback = (window as WindowWithStorageFallback).__nsLocalStorageFallback;
  if (fallback && typeof fallback.getItem === "function") return fallback;

  return null;
}
