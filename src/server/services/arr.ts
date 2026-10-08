import type { DatabaseSync } from 'node:sqlite';
import { type ConnectionStatus, readSetting, requestWithTimeout, type ServiceOptions } from './connection.js';

const labels = { sonarr: 'Sonarr', radarr: 'Radarr' } as const;

export const createArr = (service: 'sonarr' | 'radarr', database: DatabaseSync, options: ServiceOptions = {}) => {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const label = labels[service];

  const readConfiguration = () => {
    const url = readSetting(database, 'serviceAddresses', `${service}.url`);
    const apiKey = readSetting(database, 'credentials', `${service}.apiKey`);
    return url === undefined || apiKey === undefined ? undefined : { url, apiKey };
  };

  const request = async (
    path: string,
    init: { method?: 'GET' | 'POST'; body?: unknown } = {},
  ): Promise<{ status: number; body: unknown }> => {
    const configuration = readConfiguration();
    if (configuration === undefined) throw new Error(`${label} is not configured.`);
    const method = init.method ?? 'GET';
    const headers: Record<string, string> = { 'X-Api-Key': configuration.apiKey, Accept: 'application/json' };
    if (method === 'POST') headers['Content-Type'] = 'application/json';
    let response: Response;
    try {
      response = await requestWithTimeout(fetchImpl, configuration.url.replace(/\/+$/, '') + path, {
        method,
        headers,
        body: method === 'POST' ? JSON.stringify(init.body) : undefined,
      });
    } catch {
      throw new Error(`${label} is unreachable.`);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    return { status: response.status, body };
  };

  const check = async (): Promise<ConnectionStatus> => {
    if (readConfiguration() === undefined) return { kind: 'not_configured' };
    let result: { status: number; body: unknown };
    try {
      result = await request('/api/v3/system/status');
    } catch {
      return { kind: 'unreachable' };
    }
    if (result.status === 401 || result.status === 403) return { kind: 'rejected' };
    if (result.status < 200 || result.status > 299) return { kind: 'unreachable' };
    const { body } = result;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return { kind: 'unreachable' };
    const { version } = body as Record<string, unknown>;
    if (typeof version !== 'string' || version === '') return { kind: 'unreachable' };
    return { kind: 'ok', version };
  };

  return { check, request, configured: () => readConfiguration() !== undefined };
};
