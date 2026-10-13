import { lazy, useEffect, type ComponentType } from 'react';
import { Button } from './components/ui/button';
import { Callout } from './components/ui/callout';
import { useScreenReady } from './navigation';

const screenLoaders: Array<() => Promise<unknown>> = [];

const RELOADED_AT = 'media-manager-2.screen-reload-at';
const RELOAD_GAP_MS = 60_000;

// The browser never fetches a module again in the same tab once its download failed, so only a page reload can load it.
// The reload waits until the app answers again, and happens at most once a minute so a chunk that keeps failing cannot loop.
const reloadWhenBack = async () => {
  try {
    if (Date.now() - Number(sessionStorage.getItem(RELOADED_AT) ?? 0) < RELOAD_GAP_MS) return;
    const response = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' });
    if (!response.ok) return;
    sessionStorage.setItem(RELOADED_AT, String(Date.now()));
    window.location.reload();
  } catch {
    // Still offline or storage is blocked; the next check or the Reload button tries again.
  }
};

function ScreenLoadFailed() {
  useEffect(() => {
    void reloadWhenBack();
    const retry = () => void reloadWhenBack();
    // The online event covers this device's network; the timer covers the server coming back.
    window.addEventListener('online', retry);
    const timer = window.setInterval(retry, 10_000);
    return () => {
      window.removeEventListener('online', retry);
      window.clearInterval(timer);
    };
  }, []);
  return (
    <div className="pt-10">
      <Callout title="This screen didn't load." action={<Button variant="outline" onClick={() => window.location.reload()}>Reload</Button>}>
        It loads by itself once the connection is back. If it doesn't, reload the page.
      </Callout>
    </div>
  );
}

/** A rarely opened screen in its own chunk; render it under a Suspense boundary that holds only that screen. */
export function lazyScreen<P extends object>(load: () => Promise<ComponentType<P>>) {
  screenLoaders.push(load);
  return lazy(() => load().then(
    (component) => ({ default: component }),
    () => ({ default: ScreenLoadFailed as ComponentType<P> }),
  ));
}

/** Fetches every lazyScreen chunk ahead of its first use. */
export const preloadScreens = () => {
  for (const load of screenLoaders) void load().catch(() => undefined);
};

/** The Suspense fallback for a lazy screen: it holds the screen change, so the old screen stays up while the chunk loads. */
export function ScreenLoading() {
  useScreenReady(false);
  return null;
}

