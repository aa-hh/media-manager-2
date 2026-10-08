import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { openDatabase } from './database.js';

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
  const app = createApp({
    clientDirectory,
    listeningHost: host,
    ownerPlexId: process.env.PLEX_OWNER_ID,
    publicOrigin: process.env.APP_ORIGIN,
  });
  serve({ fetch: app.fetch, hostname: host, port }, (info) => {
    console.log(`Listening on http://${host}:${info.port}`);
  });
}
