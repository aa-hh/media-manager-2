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
  // The desktop app opens its next window in the same theme; builds older than the page have no setTheme.
  void desktopBridge()?.setTheme?.(choice).catch(() => undefined);
};
