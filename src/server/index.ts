import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { openDatabase } from './database.js';

const app = new Hono();
const clientDirectory = fileURLToPath(new URL('../client/', import.meta.url));
const applicationDocument = serveStatic({ root: clientDirectory, path: 'index.html' });

app.on(['GET', 'HEAD'], '*', serveStatic({ root: clientDirectory }));
app.on(['GET', 'HEAD'], '*', async (context, next) => {
  const path = context.req.path;
  const acceptsHtml = context.req.header('Accept')?.split(',').some(
    (type) => {
      const [mediaType, ...parameters] = type.split(';').map((part) => part.trim());
      const quality = parameters.find((parameter) => parameter.startsWith('q='))?.slice(2);
      return mediaType === 'text/html' && (quality === undefined || Number(quality) > 0);
    },
  );
  if (acceptsHtml && !extname(path) && path !== '/assets' && !path.startsWith('/assets/')) {
    return applicationDocument(context, next);
  }
  return context.notFound();
});
app.notFound((context) => context.text('Not Found', 404));

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
  serve({ fetch: app.fetch, hostname: host, port }, (info) => {
    console.log(`Listening on http://${host}:${info.port}`);
  });
}
