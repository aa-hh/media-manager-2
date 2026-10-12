import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

type Item = { name: string; value: number; route: string; path?: string; rating?: Metric['rating']; status?: number };

// The same limits POST /api/metrics checks; an item outside them would get the whole batch refused.
const pagePath = (value: string) => value.length <= 200 && /^\/[A-Za-z0-9/_.\-]*$/.test(value);
const allowed = (item: Item) => Number.isFinite(item.value) && item.value >= 0 && item.value <= 600_000
  && pagePath(item.route) && (item.path === undefined || pagePath(item.path));

const queue: Item[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
const nativeFetch = window.fetch.bind(window);

// A batch the server could not take (restarting, offline) goes back in line for the next send, up to a cap.
const requeue = (items: Item[]) => {
  queue.unshift(...items.slice(0, Math.max(0, 200 - queue.length)));
  timer ??= setTimeout(flush, 5_000);
};

function flush() {
  clearTimeout(timer);
  timer = undefined;
  while (queue.length > 0) {
    const items = queue.splice(0, 50);
    // sendBeacon cannot send X-Requested-With, which every signed-in POST needs; keepalive lets the request outlive the page.
    nativeFetch('/api/metrics', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'media-manager-2' },
      body: JSON.stringify(items),
    }).then((response) => {
      // Signed out: drop what is queued and keep collecting, since sign-in re-renders this page without a reload.
      if (response.status === 401) queue.length = 0;
      else if (response.status >= 500) requeue(items);
    }).catch(() => requeue(items));
  }
}

const push = (item: Item) => {
  if (!allowed(item)) return;
  queue.push(item);
  timer ??= setTimeout(flush, 5_000);
};

// Sends page-speed numbers, the time each API request took, and every API request that failed to the server's log.
export const startMetrics = () => {
  const report = ({ name, value, rating }: Metric) => push({ name, value, rating, route: location.pathname });
  onLCP(report);
  onINP(report);
  onCLS(report);
  onFCP(report);
  onTTFB(report);

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const url = new URL(entry.name);
      const { pathname } = url;
      if (url.origin !== location.origin || !pathname.startsWith('/api/')) continue;
      if (pathname === '/api/metrics' || pathname === '/api/events' || pathname.startsWith('/api/images/')) continue;
      push({ name: 'api', value: entry.duration, route: location.pathname, path: pathname });
    }
  }).observe({ type: 'resource', buffered: true });

  // Every request the app makes passes through fetch, so a failed one is reported here whichever screen sent it.
  // 401 is left out: signed-out checks answer it all the time.
  window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    const report = url.origin === location.origin && url.pathname.startsWith('/api/') && url.pathname !== '/api/metrics';
    const route = location.pathname;
    const started = performance.now();
    try {
      const response = await nativeFetch(input, init);
      if (report && response.status >= 400 && response.status !== 401) {
        push({ name: 'api-failed', value: performance.now() - started, route, path: url.pathname, status: response.status });
      }
      return response;
    } catch (error) {
      if (report && !(error instanceof DOMException && error.name === 'AbortError')) {
        push({ name: 'api-failed', value: performance.now() - started, route, path: url.pathname, status: 0 });
      }
      throw error;
    }
  };

  addEventListener('pagehide', flush);
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
};
