import type { DatabaseSync } from 'node:sqlite';
import { type ConnectionStatus, readSetting, requestWithTimeout, type ServiceOptions } from './connection.js';

type XmlRpcValue = string | number | XmlRpcValue[] | { [name: string]: XmlRpcValue };

type Outcome =
  | { kind: 'not_configured' }
  | { kind: 'rejected' }
  | { kind: 'unreachable' }
  | { kind: 'fault'; faultCode: number; faultString: string }
  | { kind: 'value'; value: XmlRpcValue };

const escapeText = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

// razor: params are strings only; add integer encoding when a caller needs to send one.
const encodeMethodCall = (method: string, params: readonly string[]) => (
  `<?xml version="1.0"?><methodCall><methodName>${escapeText(method)}</methodName><params>${
    params.map((param) => `<param><value><string>${escapeText(param)}</string></value></param>`).join('')
  }</params></methodCall>`
);

const entities: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

const decodeText = (raw: string): string => raw.replace(/&([^;&]*)(;?)/g, (_match, name: string, semicolon: string) => {
  if (semicolon !== ';') throw new Error('Malformed XML-RPC response.');
  if (Object.hasOwn(entities, name)) return entities[name];
  if (/^#[0-9]+$/.test(name)) return String.fromCodePoint(Number(name.slice(1)));
  if (/^#x[0-9a-fA-F]+$/.test(name)) return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
  throw new Error('Malformed XML-RPC response.');
});

// razor: accepts only string, untyped, int, i4, i8, array and struct values; boolean, double,
// dateTime.iso8601 and base64 are rejected until an rTorrent command returns one.
const parseMethodResponse = (text: string): { value: XmlRpcValue } | { faultCode: number; faultString: string } => {
  let position = 0;
  const fail = (): never => { throw new Error('Malformed XML-RPC response.'); };
  const skipSpace = () => {
    while (position < text.length && /\s/.test(text[position])) position += 1;
  };
  const peek = (name: string) => {
    skipSpace();
    return text.startsWith(`<${name}>`, position);
  };
  const expect = (tag: string) => {
    skipSpace();
    if (!text.startsWith(tag, position)) fail();
    position += tag.length;
  };
  const readText = () => {
    const end = text.indexOf('<', position);
    if (end === -1) fail();
    const raw = text.slice(position, end);
    position = end;
    return decodeText(raw);
  };
  const readInteger = (tag: string) => {
    expect(`<${tag}>`);
    const raw = readText();
    if (!/^\s*[+-]?[0-9]+\s*$/.test(raw)) fail();
    expect(`</${tag}>`);
    return Number(raw);
  };

  const parseValue = (): XmlRpcValue => {
    expect('<value>');
    const next = text.indexOf('<', position);
    if (next === -1) fail();
    if (text.startsWith('</value>', next)) {
      const value = readText();
      expect('</value>');
      return value;
    }
    if (text.slice(position, next).trim() !== '') fail();
    let value: XmlRpcValue;
    if (peek('string')) {
      expect('<string>');
      value = readText();
      expect('</string>');
    } else if (peek('int')) {
      value = readInteger('int');
    } else if (peek('i4')) {
      value = readInteger('i4');
    } else if (peek('i8')) {
      value = readInteger('i8');
    } else if (peek('array')) {
      expect('<array>');
      expect('<data>');
      const items: XmlRpcValue[] = [];
      while (peek('value')) items.push(parseValue());
      expect('</data>');
      expect('</array>');
      value = items;
    } else if (peek('struct')) {
      expect('<struct>');
      const members: { [name: string]: XmlRpcValue } = {};
      while (peek('member')) {
        expect('<member>');
        expect('<name>');
        const name = readText();
        expect('</name>');
        Object.defineProperty(members, name, { value: parseValue(), enumerable: true, writable: true, configurable: true });
        expect('</member>');
      }
      expect('</struct>');
      value = members;
    } else {
      return fail();
    }
    expect('</value>');
    return value;
  };

  skipSpace();
  if (text.startsWith('<?xml', position)) {
    const end = text.indexOf('?>', position);
    if (end === -1) fail();
    position = end + 2;
  }
  expect('<methodResponse>');
  let result: { value: XmlRpcValue } | { faultCode: number; faultString: string };
  if (peek('params')) {
    expect('<params>');
    expect('<param>');
    result = { value: parseValue() };
    expect('</param>');
    expect('</params>');
  } else {
    expect('<fault>');
    const fault = parseValue();
    expect('</fault>');
    if (typeof fault !== 'object' || Array.isArray(fault)) return fail();
    const { faultCode, faultString } = fault;
    if (typeof faultCode !== 'number' || typeof faultString !== 'string') return fail();
    result = { faultCode, faultString };
  }
  expect('</methodResponse>');
  skipSpace();
  if (position !== text.length) fail();
  return result;
};

export const createRtorrent = (database: DatabaseSync, options: ServiceOptions = {}) => {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  const send = async (method: string, params: readonly string[]): Promise<Outcome> => {
    const url = readSetting(database, 'serviceAddresses', 'rtorrent.url');
    const username = readSetting(database, 'credentials', 'rtorrent.username');
    const password = readSetting(database, 'credentials', 'rtorrent.password');
    if (url === undefined || username === undefined || password === undefined) return { kind: 'not_configured' };
    let response: Response;
    try {
      response = await requestWithTimeout(fetchImpl, url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
        },
        body: encodeMethodCall(method, params),
      });
    } catch {
      return { kind: 'unreachable' };
    }
    if (response.status === 401 || response.status === 403) return { kind: 'rejected' };
    if (response.status < 200 || response.status > 299) return { kind: 'unreachable' };
    try {
      const parsed = parseMethodResponse(await response.text());
      return 'value' in parsed ? { kind: 'value', value: parsed.value } : { kind: 'fault', ...parsed };
    } catch {
      return { kind: 'unreachable' };
    }
  };

  const call = async (method: string, params: readonly string[]): Promise<XmlRpcValue> => {
    const outcome = await send(method, params);
    switch (outcome.kind) {
      case 'value': return outcome.value;
      case 'not_configured': throw new Error('rTorrent is not configured.');
      case 'rejected': throw new Error('rTorrent rejected the credentials.');
      case 'unreachable': throw new Error('rTorrent is unreachable.');
      case 'fault': throw new Error(`rTorrent fault ${outcome.faultCode}: ${outcome.faultString}`);
    }
  };

  const check = async (): Promise<ConnectionStatus> => {
    const outcome = await send('system.client_version', []);
    switch (outcome.kind) {
      case 'not_configured': return { kind: 'not_configured' };
      case 'rejected':
      case 'fault': return { kind: 'rejected' };
      case 'unreachable': return { kind: 'unreachable' };
      case 'value':
        return typeof outcome.value === 'string' && outcome.value !== ''
          ? { kind: 'ok', version: outcome.value }
          : { kind: 'unreachable' };
    }
  };

  return { check, call };
};
