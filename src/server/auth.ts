import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  sign,
  type KeyObject,
} from 'node:crypto';
import { isIP } from 'node:net';
import type { DatabaseSync } from 'node:sqlite';
import { effectiveOwner, type Owner, readEnvironmentOwner, replaceOwner, saveOwner } from './owner.js';
import { readSetting } from './services/connection.js';
import {
  authenticateByName,
  authenticateWithQuickConnect,
  identify,
  type JellyfinUser,
  quickConnectInitiate,
  quickConnectState,
} from './services/jellyfin.js';
import { setSetting } from './settings.js';

const PRODUCT = 'media-manager-2';
const PIN_ENDPOINT = 'https://clients.plex.tv/api/v2/pins';
const USER_ENDPOINT = 'https://plex.tv/api/v2/user';
const HANDOFF_ENDPOINT = 'https://app.plex.tv/auth';
const ATTEMPT_LIFETIME_MS = 10 * 60_000;
const SESSION_LIFETIME_MS = 24 * 60 * 60_000;
const RATE_WINDOW_MS = 60_000;
// Per client, so a stranger at the cap leaves the owner room; across all clients the backstop is ten times these.
const MAX_STARTS_PER_WINDOW = 10;
const MAX_ATTEMPTS = 100;
const ALL_CLIENTS = 10;
const MAX_SESSIONS = 100;

type Attempt = {
  client: string;
  bindingHash: string;
  stateHash: string;
  pinId: number;
  clientIdentifier: string;
  kid: string;
  privateKey: KeyObject;
  expiresAt: number;
  checking: boolean;
};

type QuickConnectAttempt = {
  client: string;
  url: string;
  secret: string;
  expiresAt: number;
  checking: boolean;
};

type Configuration = {
  origin: string;
  secure: boolean;
};

export type AuthenticationOptions = {
  listeningHost: string;
  ownerPlexId?: string;
  publicOrigin?: string;
  database: DatabaseSync;
  now: () => number;
  fetch: typeof globalThis.fetch;
};

export type StartResult =
  | { kind: 'success'; binding: string; expiresAt: number; url: string }
  | { kind: 'not_configured' }
  | { kind: 'unavailable' }
  | { kind: 'rate_limited'; retryAfter: number };

export type CompleteResult =
  | { kind: 'success'; session: string; expiresAt: number }
  | { kind: 'pending' }
  | { kind: 'invalid_flow' }
  | { kind: 'flow_expired' }
  | { kind: 'in_progress' }
  | { kind: 'owner_only' }
  | { kind: 'unavailable' };

type RateLimited = { kind: 'rate_limited'; retryAfter: number };

export type JellyfinCheckResult =
  | { kind: 'ok'; url: string; serverName: string }
  | { kind: 'no_answer' }
  | { kind: 'not_jellyfin' }
  | { kind: 'invalid_url' | 'owner_exists' | 'not_configured' }
  | RateLimited;

export type JellyfinSignInResult =
  | { kind: 'success'; session: string; expiresAt: number }
  | { kind: 'not_administrator'; userName: string; serverName: string }
  | { kind: 'refused' | 'unavailable' | 'owner_only' | 'owner_exists' | 'invalid_url' | 'not_configured' }
  | { kind: 'pending' | 'invalid_flow' | 'flow_expired' | 'in_progress' }
  | RateLimited;

export type JellyfinQuickConnectStartResult =
  | { kind: 'success'; binding: string; code: string; expiresAt: number }
  | { kind: 'off' | 'unavailable' | 'owner_exists' | 'invalid_url' | 'not_configured' }
  | RateLimited;

export type SessionResult =
  | { kind: 'success'; expiresAt: number }
  | { kind: 'unauthenticated' | 'expired' };

const hash = (value: string) => createHash('sha256').update(value, 'utf8').digest('base64url');

export const isLoopback = (host: string) => {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost'
    || normalized === '::1'
    || (isIP(normalized) === 4 && normalized.startsWith('127.'));
};

const readConfiguration = (publicOrigin: string | undefined, listeningHost: string): Configuration | undefined => {
  if (publicOrigin === undefined) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(publicOrigin);
  } catch {
    return undefined;
  }
  if (
    parsed.username
    || parsed.password
    || parsed.pathname !== '/'
    || parsed.search
    || parsed.hash
    || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
  ) return undefined;
  if (parsed.protocol === 'http:' && (!isLoopback(parsed.hostname) || !isLoopback(listeningHost))) return undefined;
  return { origin: parsed.origin, secure: parsed.protocol === 'https:' };
};

// A Jellyfin address typed on the first-run page: http or https, nothing but host, port and path.
const normalizeServerUrl = (value: string): string | undefined => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return undefined;
  }
  if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.username || parsed.password || parsed.search || parsed.hash) {
    return undefined;
  }
  return parsed.origin + parsed.pathname.replace(/\/+$/, '');
};

const providerExpiry = (value: unknown) => {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
};

const providerHeaders = (clientIdentifier: string) => ({
  Accept: 'application/json',
  'X-Plex-Product': PRODUCT,
  'X-Plex-Client-Identifier': clientIdentifier,
});

const providerJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const createAuthentication = (options: AuthenticationOptions) => {
  const environmentOwner = readEnvironmentOwner(options.ownerPlexId);
  // A set but malformed PLEX_OWNER_ID turns sign-in off instead of opening first run to anyone.
  const invalidOwnerId = (options.ownerPlexId ?? '') !== '' && environmentOwner === undefined;
  const configuration = invalidOwnerId ? undefined : readConfiguration(options.publicOrigin, options.listeningHost);
  const attempts = new Map<string, Attempt>();
  const quickConnects = new Map<string, QuickConnectAttempt>();
  const { database } = options;
  const currentOwner = () => effectiveOwner(database, options.ownerPlexId);
  // The owner's Plex account token from sign-in, by session hash. Kept out of the database (and so out of backups);
  // a restart drops it and setup's Plex step falls back to a pasted token.
  const plexTokens = new Map<string, string>();
  let starts: Array<{ client: string; at: number }> = [];
  const pendingStarts: string[] = [];
  const settleStart = (client: string) => pendingStarts.splice(pendingStarts.indexOf(client), 1);

  const removeExpiredAttempts = () => {
    const currentTime = options.now();
    for (const [key, attempt] of attempts) {
      if (currentTime >= attempt.expiresAt) attempts.delete(key);
    }
    for (const [key, attempt] of quickConnects) {
      if (currentTime >= attempt.expiresAt) quickConnects.delete(key);
    }
  };

  // Sessions live in the database so a restart keeps the owner signed in; only each token's hash is stored.
  const deleteSession = (key: string) => {
    database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(key);
    plexTokens.delete(key);
  };

  const createSession = (ownerUserId: string, suppliedSession: string | undefined) => {
    if (suppliedSession !== undefined) deleteSession(hash(suppliedSession));
    for (const { token_hash } of database.prepare('DELETE FROM sessions WHERE expires_at <= ? RETURNING token_hash')
      .all(options.now()) as Array<{ token_hash: string }>) plexTokens.delete(token_hash);
    const { count } = database.prepare('SELECT count(*) AS count FROM sessions').get() as { count: number };
    if (count >= MAX_SESSIONS) return { kind: 'unavailable' as const };
    const session = randomBytes(32).toString('base64url');
    const expiresAt = options.now() + SESSION_LIFETIME_MS;
    database.prepare('INSERT INTO sessions (token_hash, owner_id, expires_at) VALUES (?, ?, ?)')
      .run(hash(session), ownerUserId, expiresAt);
    return { kind: 'success' as const, session, expiresAt };
  };

  // The media-server switch: the current owner, signed in, logs in with the other server. Off while PLEX_OWNER_ID pins the owner.
  const switching = (suppliedSession: string | undefined) => environmentOwner === undefined
    && currentOwner() !== undefined
    && suppliedSession !== undefined
    && validateSession(suppliedSession).kind === 'success';

  // Swaps the owner and ends every session in one write; the caller then creates the new owner's session.
  const switchOwner = (owner: Owner) => {
    database.exec('BEGIN IMMEDIATE;');
    try {
      replaceOwner(database, owner);
      database.exec('DELETE FROM sessions;');
      database.exec('COMMIT;');
    } catch {
      database.exec('ROLLBACK;'); // the owner check after the switch refuses
      return;
    }
    plexTokens.clear();
  };

  const requestProvider = (url: string, init: RequestInit) => options.fetch(url, {
    ...init,
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });

  // Plex starts and the Jellyfin requests that reach a server share one window per client.
  const rateLimited = (client: string): RateLimited | undefined => {
    const currentTime = options.now();
    starts = starts.filter((started) => currentTime - started.at < RATE_WINDOW_MS);
    const own = starts.filter((started) => started.client === client);
    const limiting = own.length >= MAX_STARTS_PER_WINDOW ? own : starts.length >= MAX_STARTS_PER_WINDOW * ALL_CLIENTS ? starts : undefined;
    if (limiting === undefined) return undefined;
    return { kind: 'rate_limited', retryAfter: Math.max(1, Math.ceil((limiting[0].at + RATE_WINDOW_MS - currentTime) / 1000)) };
  };
  const admit = (client: string) => {
    const limited = rateLimited(client);
    if (limited === undefined) starts.push({ client, at: options.now() });
    return limited;
  };

  const start = async (existingBinding: string | undefined, client: string): Promise<StartResult> => {
    if (configuration === undefined) return { kind: 'not_configured' };
    removeExpiredAttempts();
    const currentTime = options.now();
    const limited = rateLimited(client);
    if (limited !== undefined) return limited;
    if (existingBinding !== undefined) attempts.delete(hash(existingBinding));
    const held = [...attempts.values()].filter((attempt) => attempt.client === client).length
      + pendingStarts.filter((pending) => pending === client).length;
    if (held >= MAX_ATTEMPTS || attempts.size + pendingStarts.length >= MAX_ATTEMPTS * ALL_CLIENTS) return { kind: 'unavailable' };
    starts.push({ client, at: currentTime });
    pendingStarts.push(client);

    const clientIdentifier = randomUUID();
    const kid = randomUUID();
    const binding = randomBytes(32).toString('base64url');
    const state = randomBytes(32).toString('base64url');
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const exported = publicKey.export({ format: 'jwk' });
    const jwk = { kty: 'OKP', crv: 'Ed25519', x: exported.x, kid, alg: 'EdDSA' };

    let response: Response;
    try {
      response = await requestProvider(PIN_ENDPOINT, {
        method: 'POST',
        headers: { ...providerHeaders(clientIdentifier), 'Content-Type': 'application/json' },
        body: JSON.stringify({ strong: true, jwk }),
      });
    } catch {
      settleStart(client);
      return { kind: 'unavailable' };
    }
    if (response.status !== 201) {
      settleStart(client);
      return { kind: 'unavailable' };
    }
    const body = await providerJson(response);
    settleStart(client);
    if (!isRecord(body)) return { kind: 'unavailable' };
    const pinId = body.id;
    const code = body.code;
    const returnedExpiry = providerExpiry(body.expiresAt);
    if (
      typeof pinId !== 'number'
      || !Number.isSafeInteger(pinId)
      || pinId <= 0
      || typeof code !== 'string'
      || code.length === 0
      || returnedExpiry === undefined
      || returnedExpiry <= options.now()
    ) return { kind: 'unavailable' };
    const expiresAt = Math.min(currentTime + ATTEMPT_LIFETIME_MS, returnedExpiry);
    const bindingHash = hash(binding);
    attempts.set(bindingHash, {
      client,
      bindingHash,
      stateHash: hash(state),
      pinId,
      clientIdentifier,
      kid,
      privateKey,
      expiresAt,
      checking: false,
    });

    const forwardUrl = new URL('/auth/callback', configuration.origin);
    forwardUrl.searchParams.set('state', state);
    const parameters = new URLSearchParams({
      clientID: clientIdentifier,
      code,
      'context[device][product]': PRODUCT,
      forwardUrl: forwardUrl.href,
    });
    const handoff = new URL(HANDOFF_ENDPOINT);
    handoff.hash = `?${parameters.toString()}`;
    return { kind: 'success', binding, expiresAt, url: handoff.href };
  };

  const complete = async (binding: string | undefined, state: string, suppliedSession?: string): Promise<CompleteResult> => {
    if (configuration === undefined || binding === undefined) return { kind: 'invalid_flow' };
    const bindingHash = hash(binding);
    const attempt = attempts.get(bindingHash);
    if (attempt === undefined) return { kind: 'invalid_flow' };
    if (attempt.stateHash !== hash(state)) {
      attempts.delete(bindingHash);
      return { kind: 'invalid_flow' };
    }
    if (options.now() >= attempt.expiresAt) {
      attempts.delete(bindingHash);
      return { kind: 'flow_expired' };
    }
    if (attempt.checking) return { kind: 'in_progress' };
    attempt.checking = true;

    const currentAttempt = () => attempts.get(bindingHash) === attempt;
    const stillUsable = (): CompleteResult | undefined => {
      if (!currentAttempt()) return { kind: 'invalid_flow' };
      if (options.now() >= attempt.expiresAt) {
        attempts.delete(bindingHash);
        return { kind: 'flow_expired' };
      }
      return undefined;
    };
    const terminal = (kind: CompleteResult['kind']): CompleteResult => {
      if (currentAttempt()) attempts.delete(bindingHash);
      return { kind } as CompleteResult;
    };

    const issuedAt = Math.floor(options.now() / 1000);
    const encodedHeader = Buffer.from(JSON.stringify({ alg: 'EdDSA', kid: attempt.kid, typ: 'JWT' })).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify({
      aud: 'plex.tv',
      iss: attempt.clientIdentifier,
      iat: issuedAt,
      exp: issuedAt + 60,
    })).toString('base64url');
    const signed = `${encodedHeader}.${encodedPayload}`;
    const signature = sign(null, Buffer.from(signed, 'ascii'), attempt.privateKey).toString('base64url');
    const checkUrl = new URL(`${PIN_ENDPOINT}/${attempt.pinId}`);
    checkUrl.searchParams.set('deviceJWT', `${signed}.${signature}`);

    let checkResponse: Response;
    try {
      checkResponse = await requestProvider(checkUrl.href, {
        method: 'GET',
        headers: providerHeaders(attempt.clientIdentifier),
      });
    } catch {
      return terminal('unavailable');
    }
    const afterCheck = stillUsable();
    if (afterCheck !== undefined) return afterCheck;
    if (checkResponse.status !== 200) return terminal('unavailable');
    const checkBody = await providerJson(checkResponse);
    const afterCheckBody = stillUsable();
    if (afterCheckBody !== undefined) return afterCheckBody;
    if (!isRecord(checkBody) || !Object.hasOwn(checkBody, 'authToken')) return terminal('unavailable');
    if (checkBody.authToken === null) {
      attempt.checking = false;
      return { kind: 'pending' };
    }
    if (typeof checkBody.authToken !== 'string' || checkBody.authToken.length === 0) return terminal('unavailable');

    let userResponse: Response;
    try {
      userResponse = await requestProvider(USER_ENDPOINT, {
        method: 'GET',
        headers: { ...providerHeaders(attempt.clientIdentifier), 'X-Plex-Token': checkBody.authToken },
      });
    } catch {
      return terminal('unavailable');
    }
    const afterUser = stillUsable();
    if (afterUser !== undefined) return afterUser;
    if (userResponse.status !== 200) return terminal('unavailable');
    const user = await providerJson(userResponse);
    const afterUserBody = stillUsable();
    if (afterUserBody !== undefined) return afterUserBody;
    if (!isRecord(user)) return terminal('unavailable');
    if (
      typeof user.id !== 'number'
      || !Number.isSafeInteger(user.id)
      || user.id <= 0
      || user.restricted === true
      || user.anonymous === true
    ) return terminal('owner_only');
    const userId = String(user.id);
    const userName = typeof user.username === 'string' && user.username !== '' ? user.username : userId;
    // First run: this account becomes the owner. A failed insert means another sign-in got there first.
    if (currentOwner() === undefined) {
      try {
        saveOwner(database, { provider: 'plex', userId, userName, serverName: null, serverId: null });
      } catch { /* the owner check below reads the winner */ }
    }
    if (currentOwner()?.provider === 'jellyfin' && switching(suppliedSession)) {
      switchOwner({ provider: 'plex', userId, userName, serverName: null, serverId: null });
    }
    const owner = currentOwner();
    if (owner?.provider !== 'plex' || owner.userId !== userId) return terminal('owner_only');

    attempts.delete(bindingHash);
    const created = createSession(owner.userId, suppliedSession);
    if (created.kind === 'success') plexTokens.set(hash(created.session), checkBody.authToken);
    return created;
  };

  // The Jellyfin server to sign in against: the typed address during first run, the saved one once a Jellyfin owner
  // exists or a Plex owner switches, so after first run nobody can point sign-in at a server of their own.
  const signInServer = (
    url: string | undefined,
    suppliedSession: string | undefined,
  ): { kind: 'ok'; url: string } | { kind: 'invalid_url' | 'owner_exists' | 'unavailable' } => {
    const owner = currentOwner();
    if (owner === undefined) {
      const normalized = url === undefined ? undefined : normalizeServerUrl(url);
      return normalized === undefined ? { kind: 'invalid_url' } : { kind: 'ok', url: normalized };
    }
    if ((owner.provider !== 'jellyfin' && !switching(suppliedSession)) || url !== undefined) return { kind: 'owner_exists' };
    const saved = readSetting(database, 'serviceAddresses', 'jellyfin.url');
    return saved === undefined ? { kind: 'unavailable' } : { kind: 'ok', url: saved.replace(/\/+$/, '') };
  };

  // Shared end of both Jellyfin sign-ins: administrators only; the first one becomes the owner and locks the address, and a signed-in Plex owner's switch replaces the owner.
  const finishJellyfin = async (url: string, user: JellyfinUser, suppliedSession: string | undefined): Promise<JellyfinSignInResult> => {
    let owner = currentOwner();
    let serverName = owner?.serverName ?? undefined;
    let serverId: string | null = null;
    if (serverName === undefined) {
      // First run, or a Plex owner switching to Jellyfin.
      const identified = owner === undefined || owner.provider === 'plex' ? await identify(options.fetch, url) : undefined;
      serverName = identified?.kind === 'ok' ? identified.serverName : new URL(url).host;
      serverId = identified?.kind === 'ok' ? identified.serverId : null;
    }
    if (!user.isAdministrator) return { kind: 'not_administrator', userName: user.userName, serverName };
    if (currentOwner() === undefined) {
      // Owner and locked address land together, or neither does.
      database.exec('BEGIN IMMEDIATE;');
      try {
        saveOwner(database, { provider: 'jellyfin', userId: user.userId, userName: user.userName, serverName, serverId });
        setSetting(database, 'serviceAddresses', 'jellyfin.url', url);
        database.exec('COMMIT;');
      } catch {
        database.exec('ROLLBACK;'); // the owner check below reads the winner
      }
    }
    const savedUrl = readSetting(database, 'serviceAddresses', 'jellyfin.url')?.replace(/\/+$/, '');
    // Settings already saved jellyfin.url, so the switch leaves it as it is; an address changed mid-login switches nobody.
    if (currentOwner()?.provider === 'plex' && savedUrl === url && switching(suppliedSession)) {
      switchOwner({ provider: 'jellyfin', userId: user.userId, userName: user.userName, serverName, serverId });
    }
    owner = currentOwner();
    if (owner?.provider !== 'jellyfin' || owner.userId !== user.userId || savedUrl !== url) return { kind: 'owner_only' };
    return createSession(owner.userId, suppliedSession);
  };

  const jellyfinCheck = async (url: string, client: string): Promise<JellyfinCheckResult> => {
    if (configuration === undefined) return { kind: 'not_configured' };
    if (currentOwner() !== undefined) return { kind: 'owner_exists' };
    const normalized = normalizeServerUrl(url);
    if (normalized === undefined) return { kind: 'invalid_url' };
    const limited = admit(client);
    if (limited !== undefined) return limited;
    const identified = await identify(options.fetch, normalized);
    return identified.kind === 'ok' ? { kind: 'ok', url: normalized, serverName: identified.serverName } : identified;
  };

  const jellyfinPassword = async (
    url: string | undefined,
    username: string,
    password: string,
    client: string,
    suppliedSession?: string,
  ): Promise<JellyfinSignInResult> => {
    if (configuration === undefined) return { kind: 'not_configured' };
    const server = signInServer(url, suppliedSession);
    if (server.kind !== 'ok') return server;
    const limited = admit(client);
    if (limited !== undefined) return limited;
    const result = await authenticateByName(options.fetch, server.url, username, password);
    if (result.kind !== 'ok') return result;
    return finishJellyfin(server.url, result.user, suppliedSession);
  };

  const jellyfinQuickConnectStart = async (
    url: string | undefined,
    existingBinding: string | undefined,
    client: string,
    suppliedSession?: string,
  ): Promise<JellyfinQuickConnectStartResult> => {
    if (configuration === undefined) return { kind: 'not_configured' };
    const server = signInServer(url, suppliedSession);
    if (server.kind !== 'ok') return server;
    removeExpiredAttempts();
    const limited = admit(client);
    if (limited !== undefined) return limited;
    if (existingBinding !== undefined) {
      attempts.delete(hash(existingBinding));
      quickConnects.delete(hash(existingBinding));
    }
    const initiated = await quickConnectInitiate(options.fetch, server.url);
    if (initiated.kind !== 'ok') return initiated;
    const binding = randomBytes(32).toString('base64url');
    const expiresAt = options.now() + ATTEMPT_LIFETIME_MS;
    quickConnects.set(hash(binding), { client, url: server.url, secret: initiated.secret, expiresAt, checking: false });
    return { kind: 'success', binding, code: initiated.code, expiresAt };
  };

  const jellyfinQuickConnectComplete = async (binding: string | undefined, suppliedSession?: string): Promise<JellyfinSignInResult> => {
    if (configuration === undefined || binding === undefined) return { kind: 'invalid_flow' };
    const key = hash(binding);
    const attempt = quickConnects.get(key);
    if (attempt === undefined) return { kind: 'invalid_flow' };
    if (options.now() >= attempt.expiresAt) {
      quickConnects.delete(key);
      return { kind: 'flow_expired' };
    }
    if (attempt.checking) return { kind: 'in_progress' };
    attempt.checking = true;
    // Cancel, logout or a newer start may replace the attempt while Jellyfin answers; a late answer then creates nothing.
    const stillUsable = (): JellyfinSignInResult | undefined => {
      if (quickConnects.get(key) !== attempt) return { kind: 'invalid_flow' };
      if (options.now() >= attempt.expiresAt) {
        quickConnects.delete(key);
        return { kind: 'flow_expired' };
      }
      return undefined;
    };
    const terminal = (result: JellyfinSignInResult) => {
      if (quickConnects.get(key) === attempt) quickConnects.delete(key);
      return result;
    };

    const state = await quickConnectState(options.fetch, attempt.url, attempt.secret);
    const afterState = stillUsable();
    if (afterState !== undefined) return afterState;
    if (state === 'pending') {
      attempt.checking = false;
      return { kind: 'pending' };
    }
    if (state === 'expired') return terminal({ kind: 'flow_expired' });
    if (state === 'unavailable') return terminal({ kind: 'unavailable' });
    const result = await authenticateWithQuickConnect(options.fetch, attempt.url, attempt.secret);
    const afterAuthentication = stillUsable();
    if (afterAuthentication !== undefined) return afterAuthentication;
    // Jellyfin said the code was approved, so a refusal here is Jellyfin misbehaving, not the person.
    if (result.kind !== 'ok') return terminal({ kind: 'unavailable' });
    quickConnects.delete(key);
    return finishJellyfin(attempt.url, result.user, suppliedSession);
  };

  const status = (binding?: string) => {
    if (configuration === undefined) return { configured: false, pending: false, firstRun: false, provider: null };
    const owner = currentOwner();
    let pending = false;
    if (binding !== undefined) {
      const key = hash(binding);
      const attempt = attempts.get(key);
      if (attempt !== undefined && options.now() >= attempt.expiresAt) attempts.delete(key);
      pending = attempts.has(key);
    }
    return { configured: true, pending, firstRun: owner === undefined, provider: owner?.provider ?? null };
  };

  const cancel = (binding?: string) => {
    if (binding === undefined) return;
    attempts.delete(hash(binding));
    quickConnects.delete(hash(binding));
  };

  const logout = (binding?: string, session?: string) => {
    cancel(binding);
    if (session !== undefined) deleteSession(hash(session));
  };

  const validateSession = (session?: string): SessionResult => {
    if (configuration === undefined || session === undefined) return { kind: 'unauthenticated' };
    const owner = currentOwner();
    const key = hash(session);
    const stored = database.prepare('SELECT owner_id, expires_at FROM sessions WHERE token_hash = ?')
      .get(key) as { owner_id: string; expires_at: number } | undefined;
    if (stored === undefined || owner === undefined || stored.owner_id !== owner.userId) return { kind: 'unauthenticated' };
    if (options.now() >= stored.expires_at) {
      deleteSession(key);
      return { kind: 'expired' };
    }
    return { kind: 'success', expiresAt: stored.expires_at };
  };

  // Lets setup connect Plex without a pasted token; never leaves the server.
  const plexToken = (session?: string): string | undefined => (
    validateSession(session).kind === 'success' ? plexTokens.get(hash(session as string)) : undefined
  );

  return {
    configured: configuration !== undefined,
    secure: configuration?.secure ?? false,
    origin: configuration?.origin,
    start,
    complete,
    jellyfinCheck,
    jellyfinPassword,
    jellyfinQuickConnectStart,
    jellyfinQuickConnectComplete,
    status,
    cancel,
    logout,
    validateSession,
    plexToken,
  };
};
