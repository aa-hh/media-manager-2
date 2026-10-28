'use strict';
// Which Plex address mpv streams from (network §8.2, simplified). No Electron
// here, so tests/production.test.mjs can run it.

const { originOf } = require('./page');

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

/**
 * The origins of the server's addresses (direct first) and how many are direct. A server older than this app sends no
 * count, so all count as direct; an entry that is not an address is dropped from its own group.
 */
const originsOf = (addresses, directCount) => {
  const count = Number.isSafeInteger(directCount) && directCount >= 0 ? directCount : addresses.length;
  const list = (part) => part.filter((value) => typeof value === 'string').map(originOf).filter((value) => value !== null);
  const direct = list(addresses.slice(0, count));
  return { origins: [...direct, ...list(addresses.slice(count))], directCount: direct.length };
};

/**
 * The address kept for the run (network recommendation 7). `choose(origins, directCount)` tests addresses.
 * - `testEarly(load)`: Plex's own app tests the server's addresses when it opens, not at Play (network §8.2); `load`
 *   resolves to originsOf's answer, or null when there is nothing to test.
 * - `pick(found, retest)`: waits for an early test still running, then reuses the kept address while the start reply
 *   still lists it, unless asked to test again (a retry).
 * - `forget()`: another server address; a test still running for the old one keeps nothing.
 */
const createAddressKeeper = (choose) => {
  let kept = null;
  let testing = null;
  let round = 0;
  const keep = async (at, origins, directCount) => {
    const chosen = await choose(origins, directCount);
    if (at === round) kept = chosen;
    return chosen;
  };
  return {
    testEarly(load) {
      const at = round;
      const run = (async () => {
        const found = await load();
        if (found !== null && at === round) await keep(at, found.origins, found.directCount);
      })().catch(() => {});
      testing = run;
      void run.finally(() => { if (testing === run) testing = null; });
      return run;
    },
    async pick({ origins, directCount }, retest) {
      if (testing !== null) await testing;
      if (!retest && kept !== null && origins.includes(kept)) return kept;
      return keep(round, origins, directCount);
    },
    forget() {
      round += 1;
      kept = null;
      testing = null;
    },
  };
};

module.exports = { chooseConnection, answerPasses, originsOf, createAddressKeeper, PROBE_LIMIT, PROBE_TIMEOUT_MS };
