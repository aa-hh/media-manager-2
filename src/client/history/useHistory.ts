import { useCallback, useEffect, useRef, useState } from 'react';

// The server types in src/server/history.ts and src/server/blocklist.ts are the source of truth.
export type Service = 'sonarr' | 'radarr';

export type HistoryEvent = {
  id: string;
  at: number;
  service: Service | null;
  source: 'Sonarr' | 'Radarr' | 'media-manager-2';
  title: string;
  event: string;
  detail: string;
  release: string | null;
  quality: string | null;
  byHand: boolean;
  eventType: string;
  details: {
    tracker: string | null;
    releaseGroup: string | null;
    formats: string[];
    score: number | null;
    howFound: string | null;
    ageWhenGrabbed: string | null;
    deletionReason: string | null;
    droppedPath: string | null;
    importedPath: string | null;
    message: string | null;
  };
  markFailed: { service: Service; historyId: number; movieId: number | null; episodeIds: number[]; releaseTitle: string } | null;
};

export type BlockEntry = {
  service: Service;
  id: number;
  title: string;
  release: string;
  quality: string | null;
  indexer: string | null;
  at: number;
  by: 'you' | 'media-manager-2' | 'Sonarr' | 'Radarr';
  reason: string;
};

export type HistoryFilter = 'all' | 'grabs' | 'imports' | 'failures' | 'fixes' | 'deletions';
export type ServiceChoice = Service | 'all';
export type TitleLink = { movieId?: number; seriesId?: number; episodeId?: number };

export type Paged<T> =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'ready'; items: T[]; hasMore: boolean; page: number; loadingMore: boolean };

// Title history is reached by links such as /history?service=sonarr&seriesId=3.
const readLink = () => {
  const params = new URLSearchParams(window.location.search);
  const service = params.get('service');
  const link: TitleLink = {};
  for (const key of ['movieId', 'seriesId', 'episodeId'] as const) {
    const value = params.get(key);
    if (value !== null && /^\d{1,15}$/.test(value)) link[key] = Number(value);
  }
  return { service: service === 'sonarr' || service === 'radarr' ? service as Service : 'all' as const, link };
};

// Reads one list page by page; a page only adds items whose id is not already shown, since the server repeats newer steps.
const usePaged = <T,>(onUnauthorized: () => void, url: string, read: (body: unknown) => { items: T[]; hasMore: boolean }, idOf: (item: T) => string) => {
  const [state, setState] = useState<Paged<T>>({ kind: 'loading' });
  const unauthorizedRef = useRef(onUnauthorized);
  unauthorizedRef.current = onUnauthorized;
  const versionRef = useRef(0);

  const load = useCallback(async (page: number) => {
    const version = page === 1 ? ++versionRef.current : versionRef.current;
    if (page === 1) setState({ kind: 'loading' });
    else setState((current) => (current.kind === 'ready' ? { ...current, loadingMore: true } : current));
    try {
      const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}page=${page}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (version !== versionRef.current) return;
      if (response.status === 401) {
        unauthorizedRef.current();
        return;
      }
      if (!response.ok) throw new Error('The list could not be read.');
      const { items, hasMore } = read(await response.json());
      if (version !== versionRef.current) return;
      setState((current) => {
        const previous = page > 1 && current.kind === 'ready' ? current.items : [];
        const seen = new Set(previous.map(idOf));
        return { kind: 'ready', items: [...previous, ...items.filter((item) => !seen.has(idOf(item)))], hasMore, page, loadingMore: false };
      });
    } catch {
      if (version !== versionRef.current) return;
      setState((current) => (page > 1 && current.kind === 'ready' ? { ...current, loadingMore: false } : { kind: 'failed' }));
    }
  }, [url, read, idOf]);

  useEffect(() => {
    void load(1);
    return () => { versionRef.current += 1; };
  }, [load]);

  const loadMore = useCallback(() => {
    if (state.kind === 'ready' && state.hasMore && !state.loadingMore) void load(state.page + 1);
  }, [state, load]);

  return { state, loadMore, reload: useCallback(() => load(1), [load]) };
};

const readEvents = (body: unknown) => {
  const value = body as { events?: HistoryEvent[]; hasMore?: boolean };
  return { items: value.events ?? [], hasMore: value.hasMore === true };
};
const eventId = (event: HistoryEvent) => event.id;

export const useHistory = (onUnauthorized: () => void) => {
  const [initial] = useState(readLink);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [service, setService] = useState<ServiceChoice>(initial.service);
  const ids = Object.entries(initial.link).map(([key, value]) => `&${key}=${value}`).join('');
  const paged = usePaged(onUnauthorized, `/api/history?filter=${filter}&service=${service}${ids}`, readEvents, eventId);
  return { ...paged, filter, setFilter, service, setService, link: initial.link };
};

const readEntries = (body: unknown) => {
  const value = body as { entries?: BlockEntry[]; hasMore?: boolean };
  return { items: value.entries ?? [], hasMore: value.hasMore === true };
};
const entryId = (entry: BlockEntry) => `${entry.service}:${entry.id}`;

export const useBlocklist = (onUnauthorized: () => void) => usePaged(onUnauthorized, '/api/blocklist', readEntries, entryId);

export const sendJson = async (path: string, method: 'POST' | 'DELETE', body?: unknown) => {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'media-manager-2' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => undefined) as unknown };
};
