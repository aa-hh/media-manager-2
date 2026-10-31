'use strict';
// The media-manager-2 address typed on the first-launch screen. No Electron
// here, so tests/production.test.mjs can run it.

/** The typed address as an origin (scheme, host, port), or null. A bare host means https. */
const normaliseAddress = (input) => {
  if (typeof input !== 'string') return null;
  let text = input.trim();
  if (text === '') return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `https://${text}`;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.hostname === '' || url.username !== '' || url.password !== '') return null;
  return url.origin;
};

/** Whether a reply from `GET {address}/auth/status` came from media-manager-2. */
const isMediaManager = (status, body) => status === 200 && typeof body === 'object' && body !== null && typeof body.configured === 'boolean';

module.exports = { normaliseAddress, isMediaManager };
