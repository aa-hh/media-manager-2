import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
  sign,
  type KeyObject,
} from 'node:crypto';
import { isIP } from 'node:net';

const PRODUCT = 'media-manager-2';
const PIN_ENDPOINT = 'https://clients.plex.tv/api/v2/pins';
const USER_ENDPOINT = 'https://plex.tv/api/v2/user';
const HANDOFF_ENDPOINT = 'https://app.plex.tv/auth';
const ATTEMPT_LIFETIME_MS = 10 * 60_000;
const SESSION_LIFETIME_MS = 24 * 60 * 60_000;
const RATE_WINDOW_MS = 60_000;
const MAX_STARTS_PER_WINDOW = 10;
const MAX_ATTEMPTS = 100;
const MAX_SESSIONS = 100;

type Attempt = {
  bindingHash: string;
  stateHash: string;
  pinId: number;
  clientIdentifier: string;
  kid: string;
  privateKey: KeyObject;
  expiresAt: number;
  checking: boolean;
};

type Session = {
  ownerId: number;
  expiresAt: number;
};

type Configuration = {
  ownerId: number;
  origin: string;
  secure: boolean;
};

export type AuthenticationOptions = {
  listeningHost: string;
  ownerPlexId?: string;
  publicOrigin?: string;
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

export type SessionResult =
  | { kind: 'success'; expiresAt: number }
  | { kind: 'unauthenticated' | 'expired' };

const hash = (value: string) => createHash('sha256').update(value, 'utf8').digest('base64url');

const isLoopback = (host: string) => {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost'
    || normalized === '::1'
    || (isIP(normalized) === 4 && normalized.startsWith('127.'));
};

const readConfiguration = (
  ownerPlexId: string | undefined,
  publicOrigin: string | undefined,
  listeningHost: string,
): Configuration | undefined => {
  if (ownerPlexId === undefined || !/^[1-9]\d*$/.test(ownerPlexId)) return undefined;
  const ownerId = Number(ownerPlexId);
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0 || String(ownerId) !== ownerPlexId) return undefined;
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
  return { ownerId, origin: parsed.origin, secure: parsed.protocol === 'https:' };
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
  const configuration = readConfiguration(options.ownerPlexId, options.publicOrigin, options.listeningHost);
  const attempts = new Map<string, Attempt>();
  const sessions = new Map<string, Session>();
  let starts: number[] = [];
  let pendingStarts = 0;

  const removeExpiredAttempts = () => {
    const currentTime = options.now();
    for (const [key, attempt] of attempts) {
      if (currentTime >= attempt.expiresAt) attempts.delete(key);
    }
  };

  const removeExpiredSessions = () => {
    const currentTime = options.now();
    for (const [key, session] of sessions) {
      if (currentTime >= session.expiresAt) sessions.delete(key);
    }
  };

  const requestProvider = (url: string, init: RequestInit) => options.fetch(url, {
    ...init,
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });

  const start = async (existingBinding?: string): Promise<StartResult> => {
    if (configuration === undefined) return { kind: 'not_configured' };
    removeExpiredAttempts();
    const currentTime = options.now();
    starts = starts.filter((startedAt) => currentTime - startedAt < RATE_WINDOW_MS);
    if (starts.length >= MAX_STARTS_PER_WINDOW) {
      return { kind: 'rate_limited', retryAfter: Math.max(1, Math.ceil((starts[0] + RATE_WINDOW_MS - currentTime) / 1000)) };
    }
    if (existingBinding !== undefined) attempts.delete(hash(existingBinding));
    if (attempts.size + pendingStarts >= MAX_ATTEMPTS) return { kind: 'unavailable' };
    starts.push(currentTime);
    pendingStarts += 1;

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
      pendingStarts -= 1;
      return { kind: 'unavailable' };
    }
    if (response.status !== 201) {
      pendingStarts -= 1;
      return { kind: 'unavailable' };
    }
    const body = await providerJson(response);
    pendingStarts -= 1;
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
      || user.id !== configuration.ownerId
      || user.restricted === true
      || user.anonymous === true
    ) return terminal('owner_only');

    attempts.delete(bindingHash);
    if (suppliedSession !== undefined) sessions.delete(hash(suppliedSession));
    removeExpiredSessions();
    if (sessions.size >= MAX_SESSIONS) return { kind: 'unavailable' };
    const session = randomBytes(32).toString('base64url');
    const expiresAt = options.now() + SESSION_LIFETIME_MS;
    sessions.set(hash(session), { ownerId: configuration.ownerId, expiresAt });
    return { kind: 'success', session, expiresAt };
  };

  const status = (binding?: string) => {
    if (configuration === undefined || binding === undefined) return { configured: configuration !== undefined, pending: false };
    const key = hash(binding);
    const attempt = attempts.get(key);
    if (attempt !== undefined && options.now() >= attempt.expiresAt) attempts.delete(key);
    return { configured: true, pending: attempts.has(key) };
  };

  const cancel = (binding?: string) => {
    if (binding !== undefined) attempts.delete(hash(binding));
  };

  const logout = (binding?: string, session?: string) => {
    cancel(binding);
    if (session !== undefined) sessions.delete(hash(session));
  };

  const validateSession = (session?: string): SessionResult => {
    if (configuration === undefined || session === undefined) return { kind: 'unauthenticated' };
    const key = hash(session);
    const stored = sessions.get(key);
    if (stored === undefined || stored.ownerId !== configuration.ownerId) return { kind: 'unauthenticated' };
    if (options.now() >= stored.expiresAt) {
      sessions.delete(key);
      return { kind: 'expired' };
    }
    return { kind: 'success', expiresAt: stored.expiresAt };
  };

  return {
    configured: configuration !== undefined,
    secure: configuration?.secure ?? false,
    origin: configuration?.origin,
    start,
    complete,
    status,
    cancel,
    logout,
    validateSession,
  };
};
