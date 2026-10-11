import type { DatabaseSync } from 'node:sqlite';
import type { TitleStore } from '../titleStore.js';
import { createOrchestrator } from './orchestrator.js';
import { createRows } from './rows.js';

export { createDiscoverRoutes, type Discover } from './routes.js';
export type { DiscoverResult } from './rows.js';

export const createDiscover = (options: {
  tmdb: Parameters<typeof createOrchestrator>[0]['tmdb'];
  trakt?: Parameters<typeof createOrchestrator>[0]['trakt'];
  store: TitleStore;
  database: DatabaseSync;
  now?: () => number;
  fillTimeoutMs?: number;
}) => {
  const now = options.now ?? Date.now;
  const rows = createRows(options.database, now);
  const orchestrator = createOrchestrator({ tmdb: options.tmdb, trakt: options.trakt, store: options.store, rows, now, fillTimeoutMs: options.fillTimeoutMs });
  return { rows, database: options.database, orchestrator, request: orchestrator.request, refresh: orchestrator.refresh, idle: orchestrator.idle };
};
