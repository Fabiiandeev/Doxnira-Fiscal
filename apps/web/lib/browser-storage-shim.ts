type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "clear" | "key"> & {
  readonly length: number;
};

function createMemoryStorage(): StorageLike {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
  };
}

export function installBrowserStorageShim() {
  if (typeof window === "undefined") return;

  const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
  if (descriptor?.get || descriptor?.value) return;

  const storage = createMemoryStorage();
  try {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      enumerable: true,
      value: storage,
      writable: false,
    });
  } catch {
    try {
      window.localStorage = storage;
    } catch {
      // Ignore if the browser refuses to expose storage.
    }
  }
}
