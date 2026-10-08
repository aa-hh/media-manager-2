import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { listGrabs, listQueue } from './grabs.js';
import { listOpenProblems, type SubjectType, subjectHistory } from './problems.js';
import { listTorrents } from './torrents.js';

const subjectTypes = new Set<SubjectType>(['movie', 'episode', 'torrent', 'tracker', 'dependency']);

// Read-only routes for the owner's browser; app.ts mounts them behind the sign-in guard.
export const createApiRoutes = (database: DatabaseSync) => {
  const api = new Hono();
  api.get('/downloads', (context) => context.json({
    torrents: listTorrents(database).filter((torrent) => torrent.goneAt === null),
    queue: listQueue(database),
    grabs: listGrabs(database),
    problems: listOpenProblems(database),
  }));
  api.get('/problems', (context) => context.json(listOpenProblems(database)));
  api.get('/problems/history', (context) => {
    const type = context.req.query('type') as SubjectType | undefined;
    const service = context.req.query('service') ?? '';
    const id = context.req.query('id');
    if (type === undefined || !subjectTypes.has(type) || !['', 'sonarr', 'radarr'].includes(service) || !id) {
      return context.json({ error: 'invalid_request' }, 400);
    }
    return context.json(subjectHistory(database, {
      type,
      service: service === '' ? null : service as 'sonarr' | 'radarr',
      id,
    }));
  });
  return api;
};
