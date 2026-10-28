'use strict';
// Which Plex address mpv streams from (network §8.2, simplified). No Electron
// here, so tests/production.test.mjs can run it.

const PROBE_LIMIT = 5;
const PROBE_TIMEOUT_MS = 10_000;

/**
 * Whether the server answering at `origin` is ours. With the server's id known,
 * the answer must match it. Without it, only an https plex.direct address
 * passes: its certificate is issued to this server alone, while a plain http
 * address on the owner's network could be a different Plex server.
 */
const answerPasses = (origin, answeredId, expectedId) => {
  if (typeof answeredId !== 'string' || answeredId === '') return false;
  if (typeof expectedId === 'string' && expectedId !== '') return answeredId === expectedId;
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && url.hostname.endsWith('.plex.direct');
  } catch {
    return false;
  }
};

// The first of `origins` to pass, testing at most `limit` at once; null when none passes.
const firstPassing = (origins, probe, expectedId, limit) => new Promise((resolve) => {
  let next = 0;
  let failed = 0;
  let done = false;
  const launch = () => {
    if (done || next >= origins.length) return;
    const origin = origins[next];
    next += 1;
    Promise.resolve()
      .then(() => probe(origin))
      .then((id) => answerPasses(origin, id, expectedId), () => false)
      .then((passed) => {
        if (done) return;
        if (passed) {
          done = true;
          resolve(origin);
          return;
        }
        failed += 1;
        if (failed === origins.length) {
          done = true;
          resolve(null);
        } else launch();
      });
  };
  if (origins.length === 0) resolve(null);
  for (let started = 0; started < Math.min(limit, origins.length); started += 1) launch();
});

/**
 * Tests `origins` (in the server's order: the first `directCount` direct, the
 * rest relay) at most `limit` at once. `probe(origin)` resolves to the
 * machineIdentifier that answers there (or null) and applies its own time
 * limit. As in Plex's own app, the first direct address to pass wins, so a dead
 * one never holds up a live one; relay addresses are tested only once every
 * direct one has failed. Unlike Plex, a better address answering later never
 * replaces the winner: mpv would have to reopen the file.
 */
const chooseConnection = async (origins, probe, expectedId, directCount = origins.length, limit = PROBE_LIMIT) => {
  const direct = [...new Set(origins.slice(0, directCount))];
  const relay = [...new Set(origins.slice(directCount))].filter((origin) => !direct.includes(origin));
  return (await firstPassing(direct, probe, expectedId, limit)) ?? firstPassing(relay, probe, expectedId, limit);
};

module.exports = { chooseConnection, answerPasses, PROBE_LIMIT, PROBE_TIMEOUT_MS };
