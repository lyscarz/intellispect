export type ThemeChoice = 'light' | 'dark' | 'system';

const KEY = 'operator-theme';

export function getStoredTheme(): ThemeChoice {
  const v = localStorage.getItem(KEY) as ThemeChoice | null;
  return v ?? 'system';
}

export function storeTheme(choice: ThemeChoice): void {
  localStorage.setItem(KEY, choice);
}

export function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Resolve a choice (or the stored one) to a concrete dark boolean. */
export function resolveDark(choice: ThemeChoice = getStoredTheme()): boolean {
  if (choice === 'dark') return true;
  if (choice === 'light') return false;
  return systemPrefersDark();
}

/** Used before React renders to avoid a light→dark flash. */
export function resolveInitialDark(): boolean {
  return resolveDark(getStoredTheme());
}
