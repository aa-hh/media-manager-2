export type Service = 'sonarr' | 'radarr';

export type Result<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'not_configured' | 'unreachable' | 'rejected' | 'not_found'; message: string }
  | { kind: 'refused'; status: number | null; message: string };

export type Failure = Exclude<Result<never>, { kind: 'ok' }>;

export type Answer = { status: number; body: unknown };

export type Send = (
  operation: string,
  path: string,
  init?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown },
) => Promise<Result<Answer>>;

export const labels = { sonarr: 'Sonarr', radarr: 'Radarr' } as const;

export const valueOrThrow = <T>(result: Result<T>): T => {
  if (result.kind === 'ok') return result.value;
  throw new Error(result.message);
};

export const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const words = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined);

// Sonarr and Radarr explain a refusal as { message }, { errorMessage } or a list of { errorMessage }.
const serverMessage = (body: unknown): string | undefined => {
  if (isRecord(body)) return words(body.message) ?? words(body.errorMessage);
  if (Array.isArray(body)) return body.filter(isRecord).map((item) => words(item.errorMessage)).find((message) => message !== undefined);
  return undefined;
};

export const notConfigured = (label: string, operation: string): Failure => (
  { kind: 'not_configured', message: `${label} is not configured, so ${operation} did not run.` }
);

export const unreachable = (label: string, operation: string): Failure => (
  { kind: 'unreachable', message: `${label} is unreachable, so ${operation} did not run.` }
);

// A refusal raised here rather than by Sonarr or Radarr is logged once, when it is created.
export const refusal = (message: string): Failure => {
  console.error(message);
  return { kind: 'refused', status: null, message };
};

export const classify = (label: string, operation: string, answer: Answer): Result<Answer> => {
  const { status, body } = answer;
  if (status >= 200 && status <= 299) return { kind: 'ok', value: answer };
  if (status === 401 || status === 403) return { kind: 'rejected', message: `${label} rejected the API key, so ${operation} did not run.` };
  if (status === 404) return { kind: 'not_found', message: `${label} has no such item for ${operation}.` };
  const detail = serverMessage(body);
  return { kind: 'refused', status, message: `${label} refused ${operation} with HTTP ${status}${detail === undefined ? '' : `: ${detail}`}.` };
};
