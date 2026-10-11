import { createHash, createHmac } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { readSetting, requestWithTimeout } from './connection.js';

export type R2Config = { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string };

type SignInput = {
  method: string;
  url: URL;
  headers: Record<string, string>;
  payloadHash: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
  date: string;
};

const sha256Hex = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const hmac = (key: string | Buffer, data: string) => createHmac('sha256', key).update(data).digest();
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const encode = (value: string) => encodeURIComponent(value)
  .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
const encodePath = (path: string) => path.split('/').map((segment) => encode(decodeURIComponent(segment))).join('/');
const encodeQuery = (entries: Array<[string, string]>) => entries
  .map(([name, value]) => [encode(name), encode(value)])
  .sort(([a, x], [b, y]) => compare(a, b) || compare(x, y))
  .map(([name, value]) => `${name}=${value}`)
  .join('&');

// AWS Signature Version 4: https://docs.aws.amazon.com/IAM/latest/UserGuide/create-signed-request.html
export const signRequest = (input: SignInput): string => {
  const headers = Object.entries(input.headers)
    .map(([name, value]) => [name.toLowerCase(), value.trim().replace(/\s+/g, ' ')])
    .sort(([a], [b]) => compare(a, b));
  const signedHeaders = headers.map(([name]) => name).join(';');
  const canonicalRequest = [
    input.method,
    encodePath(input.url.pathname),
    encodeQuery([...input.url.searchParams]),
    headers.map(([name, value]) => `${name}:${value}\n`).join(''),
    signedHeaders,
    input.payloadHash,
  ].join('\n');
  const day = input.date.slice(0, 8);
  const scope = `${day}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', input.date, scope, sha256Hex(canonicalRequest)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, day), input.region), input.service), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  return `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
};

const decodeXml = (text: string) => text
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

export const createR2Store = (
  config: R2Config,
  options: { fetch?: typeof globalThis.fetch; now?: () => number } = {},
) => {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const base = config.endpoint.replace(/\/+$/, '');

  // Errors name only the status so a URL, key id or secret never reaches a log or the backup_runs table.
  const request = async (method: string, key: string, query: Array<[string, string]>, body?: Uint8Array, contentType?: string) => {
    const objectPath = key === '' ? '' : `/${key.split('/').map(encode).join('/')}`;
    const url = new URL(`${base}/${encode(config.bucket)}${objectPath}`);
    url.search = encodeQuery(query);
    const payloadHash = sha256Hex(body ?? '');
    const date = new Date(now()).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const headers: Record<string, string> = { 'x-amz-content-sha256': payloadHash, 'x-amz-date': date };
    if (contentType !== undefined) headers['content-type'] = contentType;
    const authorization = signRequest({
      method,
      url,
      headers: { ...headers, host: url.host },
      payloadHash,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: 'auto',
      service: 's3',
      date,
    });
    try {
      const response = await requestWithTimeout(fetchImpl, url.href, {
        method,
        headers: { ...headers, authorization },
        body,
      }, 60_000);
      return { status: response.status, bytes: new Uint8Array(await response.arrayBuffer()) };
    } catch {
      throw new Error('R2 is unreachable.');
    }
  };
  const expectOk = ({ status }: { status: number }) => {
    if (status < 200 || status > 299) throw new Error(`R2 answered ${status}.`);
  };

  return {
    async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
      expectOk(await request('PUT', key, [], body, contentType));
    },
    async get(key: string): Promise<Uint8Array | undefined> {
      const response = await request('GET', key, []);
      if (response.status === 404) return undefined;
      expectOk(response);
      return response.bytes;
    },
    // razor: reads one ListObjectsV2 page (up to 1000 keys) while retention keeps about 300. Upgrade path: follow NextContinuationToken.
    async list(prefix: string): Promise<Array<{ key: string; size: number }>> {
      const response = await request('GET', '', [['list-type', '2'], ['prefix', prefix]]);
      expectOk(response);
      const xml = Buffer.from(response.bytes).toString('utf8');
      return [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].flatMap(([, contents]) => {
        const key = /<Key>([\s\S]*?)<\/Key>/.exec(contents)?.[1];
        const size = /<Size>(\d+)<\/Size>/.exec(contents)?.[1];
        return key === undefined || size === undefined ? [] : [{ key: decodeXml(key), size: Number(size) }];
      });
    },
    async delete(key: string): Promise<void> {
      expectOk(await request('DELETE', key, []));
    },
  };
};

const completeConfig = (parts: Partial<R2Config>): R2Config | undefined => (
  parts.endpoint && parts.bucket && parts.accessKeyId && parts.secretAccessKey
    ? { endpoint: parts.endpoint, bucket: parts.bucket, accessKeyId: parts.accessKeyId, secretAccessKey: parts.secretAccessKey }
    : undefined
);

export const readR2Config = (database: DatabaseSync): R2Config | undefined => completeConfig({
  endpoint: readSetting(database, 'serviceAddresses', 'r2.endpoint'),
  bucket: readSetting(database, 'serviceAddresses', 'r2.bucket'),
  accessKeyId: readSetting(database, 'credentials', 'r2.accessKeyId'),
  secretAccessKey: readSetting(database, 'credentials', 'r2.secretAccessKey'),
});

export const r2ConfigFromEnvironment = (env: NodeJS.ProcessEnv = process.env): R2Config | undefined => completeConfig({
  endpoint: env.R2_ENDPOINT,
  bucket: env.R2_BUCKET,
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
});
