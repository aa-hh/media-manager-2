import { lazy, type ComponentType } from 'react';
import { Button } from './components/ui/button';
import { Callout } from './components/ui/callout';

const screenLoaders: Array<() => Promise<unknown>> = [];

// A chunk that fails to load (offline, or the app was redeployed under this tab) cannot be retried in place.
function ScreenLoadFailed() {
  return (
    <div className="pt-10">
      <Callout title="This screen didn't load." action={<Button variant="outline" onClick={() => window.location.reload()}>Reload</Button>}>
        Check your connection, then reload the page.
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
