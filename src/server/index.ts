import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { openDatabase } from './database.js';
import { createEventHub } from './events.js';
import { createJobRunner } from './jobs.js';

const clientDirectory = fileURLToPath(new URL('../client/', import.meta.url));
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? '3000');

let database;
try {
  database = openDatabase();
} catch {
  console.error('Database initialization failed.');
  process.exitCode = 1;
}

if (database !== undefined) {
  const events = createEventHub();
  const runner = createJobRunner();
  const app = createApp({
    clientDirectory,
    listeningHost: host,
    ownerPlexId: process.env.PLEX_OWNER_ID,
    publicOrigin: process.env.APP_ORIGIN,
    events,
  });
  runner.start();
  const server = serve({ fetch: app.fetch, hostname: host, port }, (info) => {
    console.log(`Listening on http://${host}:${info.port}`);
  }) as Server;
  let stopping = false;
  const shutdown = async () => {
    if (stopping) process.exit(1);
    stopping = true;
    await runner.stop();
    server.close(() => process.exit(0));
    // Open event streams hold their sockets, so close() alone would wait on them forever.
    server.closeAllConnections();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
