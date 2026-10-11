import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

type Item = { name: string; value: number; route: string; path?: string; rating?: Metric['rating'] };

// The same limits POST /api/metrics checks; an item outside them would get the whole batch refused.
const pagePath = (value: string) => value.length <= 200 && /^\/[A-Za-z0-9/_.\-]*$/.test(value);
const allowed = (item: Item) => Number.isFinite(item.value) && item.value >= 0 && item.value <= 600_000
  && pagePath(item.route) && (item.path === undefined || pagePath(item.path));

const queue: Item[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

const flush = () => {
  clearTimeout(timer);
  timer = undefined;
  while (queue.length > 0) {
    const body = JSON.stringify(queue.splice(0, 50));
    // sendBeacon cannot send X-Requested-With, which every signed-in POST needs; keepalive lets the request outlive the page.
    fetch('/api/metrics', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'media-manager-2' },
      body,
    }).then((response) => {
      // Signed out: drop what is queued and keep collecting, since sign-in re-renders this page without a reload.
      if (response.status === 401) queue.length = 0;
    }).catch(() => {});
  }
};

const push = (item: Item) => {
  if (!allowed(item)) return;
  queue.push(item);
  timer ??= setTimeout(flush, 5_000);
};

// Sends page-speed numbers and the time each API request took to the server's log.
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

  addEventListener('pagehide', flush);
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
};
