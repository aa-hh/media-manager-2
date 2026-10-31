// Light, Dark or System, kept per device. The inline script in index.html applies the choice before first paint and
// follows the system while it is System; it reads the same key and values, so change both together.
import { desktopBridge } from '../desktopBridge';

export type ThemeChoice = 'light' | 'dark' | 'system';

const KEY = 'mm2.theme';

export const readThemeChoice = (): ThemeChoice => {
  try {
    const value = window.localStorage.getItem(KEY);
    if (value === 'light' || value === 'dark') return value;
  } catch { /* storage unavailable: follow the system */ }
  return 'system';
};

export const writeThemeChoice = (choice: ThemeChoice) => {
  try {
    if (choice === 'system') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, choice);
  } catch { /* the choice lasts until the page reloads */ }
  const dark = choice === 'dark' || (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  syncDesktopTheme(choice);
};

/**
 * Tells the desktop app the choice, which it applies to its window now and keeps for the next launch. Called on every page
 * load too: the page's choice belongs to one address, so after a new address or cleared storage the app's copy follows the
 * page's. Builds older than the page have no setTheme.
 */
export const syncDesktopTheme = (choice: ThemeChoice = readThemeChoice()) => {
  void desktopBridge()?.setTheme?.(choice).catch(() => undefined);
};
