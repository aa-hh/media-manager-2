import { rmSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';

// Throws away what the app fetches again on demand: saved title details and backdrops, Discover rows, and copied images.
// Sonarr and Radarr image rows stay while their files go, so the next title check (every five minutes) downloads them again.
export const clearCache = (database: DatabaseSync, imageDirectory: string) => {
  const files = database.prepare('SELECT file FROM tmdb_images UNION ALL SELECT file FROM title_images').all();
  database.exec('DELETE FROM title_store_parts; DELETE FROM title_store; DELETE FROM discover_rows; DELETE FROM tmdb_images;');
  for (const { file } of files) rmSync(join(imageDirectory, String(file)), { force: true });
};

// The button also starts that title check at once, so posters come back within seconds.
export const createCacheRoutes = (database: DatabaseSync, imageDirectory: string, recheckTitles: () => Promise<void>) => {
  const routes = new Hono();
  routes.post('/clear', (context) => {
    clearCache(database, imageDirectory);
    void recheckTitles().catch(() => undefined);
    return context.body(null, 204);
  });
  return routes;
};
