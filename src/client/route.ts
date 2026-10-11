import { useEffect, useState } from 'react';

export type Screen = 'downloads' | 'flagged' | 'history' | 'blocklist' | 'health';

const screens: Record<string, Screen> = { '/flagged': 'flagged', '/history': 'history', '/blocklist': 'blocklist', '/health': 'health' };

export const screenFromPath = (pathname: string): Screen => screens[pathname] ?? 'downloads';

export const navigate = (path: string) => {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

export const useRoute = (): Screen => {
  const [screen, setScreen] = useState(() => screenFromPath(window.location.pathname));
  useEffect(() => {
    const onPopState = () => setScreen(screenFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  return screen;
};
