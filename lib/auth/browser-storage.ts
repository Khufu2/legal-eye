/** Storage can throw in embedded/private browsers. UI state must still progress. */
export function createSafeStorage(resolve: () => Storage) {
  return {
    getItem(key: string): string | null { try { return resolve().getItem(key); } catch { return null; } },
    setItem(key: string, value: string): boolean { try { resolve().setItem(key, value); return true; } catch { return false; } },
    removeItem(key: string): void { try { resolve().removeItem(key); } catch { /* Already unavailable. */ } },
  };
}
export const safeSessionStorage = createSafeStorage(() => window.sessionStorage);
export const safeLocalStorage = createSafeStorage(() => window.localStorage);
