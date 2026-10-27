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

/**
 * Tests `origins` (in the server's order: direct first, relay last) at most
 * `limit` at once. `probe(origin)` resolves to the machineIdentifier that
 * answers there (or null) and applies its own time limit. Resolves to the
 * first origin in that order that passes once every origin before it has
 * failed, so a relay never wins while a direct address could; null when none
 * passes.
 */
const chooseConnection = (origins, probe, expectedId, limit = PROBE_LIMIT) => new Promise((resolve) => {
  const unique = [...new Set(origins)];
  const results = new Array(unique.length);
  let next = 0;
  let done = false;
  const settle = () => {
    if (done) return;
    for (let index = 0; index < unique.length; index += 1) {
      if (results[index] === undefined) return;
      if (results[index]) {
        done = true;
        resolve(unique[index]);
        return;
      }
    }
    done = true;
    resolve(null);
  };
  const launch = () => {
    if (done || next >= unique.length) return;
    const index = next;
    next += 1;
    Promise.resolve()
      .then(() => probe(unique[index]))
      .then((id) => answerPasses(unique[index], id, expectedId), () => false)
      .then((passed) => {
        results[index] = passed;
        settle();
        launch();
      });
  };
  if (unique.length === 0) resolve(null);
  for (let started = 0; started < Math.min(limit, unique.length); started += 1) launch();
});

module.exports = { chooseConnection, answerPasses, PROBE_LIMIT, PROBE_TIMEOUT_MS };
