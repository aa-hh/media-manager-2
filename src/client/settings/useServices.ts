import { useCallback, useRef, useState } from 'react';
import { useToastManager } from '@/components/ui/toast';
import { afterTest, changedCount, changes, type Check, type Draft, emptyDraft, isConfigured, list, type SavedService, type ServiceName, services, type TestResult } from './model';
import { usesSignInToken } from './setup';
import type { TrackerRequest } from './TrackerEditor';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; saved: Record<ServiceName, SavedService> };

export const writeHeaders = { 'Content-Type': 'application/json', 'X-Requested-With': 'media-manager-2', Accept: 'application/json' };
/** Sends one request under `base`; a 401 signs the screen out and throws. */
export const requester = (base: string, signedOut: () => void): TrackerRequest => async (method, path, body) => {
  const response = await fetch(`${base}${path}`, {
    method, credentials: 'same-origin', headers: writeHeaders, body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 401) {
    signedOut();
    throw new Error('Signed out.');
  }
  return response;
};

export const infoOf = (name: ServiceName) => services.find((info) => info.name === name)!;
const idle = Object.fromEntries(services.map((info) => [info.name, { kind: 'idle' }])) as Record<ServiceName, Check>;

/**
 * The saved services, their last tests and their forms, shared by Settings and the setup wizard. Connect tests the form,
 * then saves it; Plex can instead connect with the owner's sign-in token through /api/setup/plex.
 */
export function useServices(onUnauthenticated: () => void) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [checks, setChecks] = useState(idle);
  const [drafts, setDrafts] = useState<Partial<Record<ServiceName, Draft>>>({});
  const [replacing, setReplacing] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Partial<Record<ServiceName, 'connect' | 'check'>>>({});
  const [problems, setProblems] = useState<Partial<Record<ServiceName, string>>>({});
  // The server name from a test that reached a different server than the saved one, until the address changes or the next test.
  const [differentServers, setDifferentServers] = useState<Partial<Record<ServiceName, string>>>({});
  const [plexSignIn, setPlexSignIn] = useState<boolean>();
  const toasts = useToastManager();
  const checksRef = useRef(checks);
  checksRef.current = checks;
  const loadRef = useRef(load);
  loadRef.current = load;
  const unauthorizedRef = useRef(onUnauthenticated);
  unauthorizedRef.current = onUnauthenticated;
  // Set synchronously, so a second Connect for the same service before the next render sends nothing.
  const connecting = useRef(new Set<ServiceName>());

  /** Tests one service with the given form values laid over the saved ones; undefined when the test could not run. */
  const test = useCallback(async (name: ServiceName, body: object, ofSaved: boolean): Promise<TestResult | undefined> => {
    const previous = checksRef.current[name];
    setChecks((current) => ({ ...current, [name]: { kind: 'testing' } }));
    setProblems((current) => ({ ...current, [name]: undefined }));
    setDifferentServers((current) => ({ ...current, [name]: undefined }));
    try {
      const response = await fetch(`/api/settings/test/${name}`, { method: 'POST', credentials: 'same-origin', headers: writeHeaders, body: JSON.stringify(body) });
      if (response.status === 401) {
        unauthorizedRef.current();
        return undefined;
      }
      if (!response.ok) throw new Error('The test did not run.');
      const result = await response.json() as TestResult;
      const { check, differentServer } = afterTest(previous, result, Date.now(), ofSaved);
      setChecks((current) => ({ ...current, [name]: check }));
      if (differentServer !== undefined) setDifferentServers((current) => ({ ...current, [name]: differentServer }));
      return result;
    } catch {
      setChecks((current) => ({ ...current, [name]: previous }));
      setProblems((current) => ({ ...current, [name]: 'The test could not reach media-manager-2. Try again.' }));
      return undefined;
    }
  }, []);

  /** Reads the saved services, then checks every saved connection so each row says whether it answers now. Throws when the read fails. */
  const read = useCallback(async () => {
    const response = await fetch('/api/settings', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (response.status === 401) {
      unauthorizedRef.current();
      return;
    }
    if (!response.ok) throw new Error('Settings could not be read.');
    const body = await response.json() as { services: SavedService[] };
    const saved = Object.fromEntries(body.services.map((service) => [service.service, service])) as Record<ServiceName, SavedService>;
    setLoad({ kind: 'ready', saved });
    for (const info of services) if (isConfigured(saved[info.name])) void test(info.name, {}, true);
  }, [test]);

  const saved = load.kind === 'ready' ? load.saved : undefined;
  const draftOf = (name: ServiceName) => drafts[name] ?? emptyDraft(saved?.[name]);
  const editedOf = (name: ServiceName) => changedCount(name, saved?.[name], draftOf(name));
  // The sign-in token is the default only while no Plex token is saved.
  const usingSignIn = (available: boolean) => usesSignInToken(available, plexSignIn, saved?.plex.credentials['plex.token'] === true);

  const clearForm = (name: ServiceName) => {
    setDrafts((current) => ({ ...current, [name]: undefined }));
    setReplacing((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${name}.`))));
    setProblems((current) => ({ ...current, [name]: undefined }));
    setDifferentServers((current) => ({ ...current, [name]: undefined }));
  };

  /** Tests the form, then saves what changed. True once saved. */
  const connect = async (name: ServiceName) => {
    if (saved === undefined || connecting.current.has(name)) return false;
    connecting.current.add(name);
    const info = infoOf(name);
    const changed = changes(name, saved[name], draftOf(name));
    setPending((current) => ({ ...current, [name]: 'connect' }));
    try {
      const result = await test(name, changed, false);
      if (result?.kind !== 'ok') return false;
      const writes = [
        ...Object.entries(changed.serviceAddresses ?? {}).map(([key, value]) => ['serviceAddresses', key, value]),
        ...Object.entries(changed.credentials ?? {}).map(([key, value]) => ['credentials', key, value]),
      ];
      let statuses: number[];
      try {
        statuses = await Promise.all(writes.map(async ([category, key, value]) => (await fetch(`/api/settings/${category}/${encodeURIComponent(key)}`, {
          method: 'PUT', credentials: 'same-origin', headers: writeHeaders, body: JSON.stringify({ value }),
        })).status));
      } catch {
        statuses = [0];
      }
      if (statuses.includes(401)) {
        unauthorizedRef.current();
        return false;
      }
      if (statuses.some((status) => status !== 204)) {
        // The form keeps its values, so nothing typed is lost.
        setProblems((current) => ({ ...current, [name]: `${info.label} answered, but the new settings could not be saved. Try again.` }));
        return false;
      }
      // Built from the latest state: another service's Connect may have saved while this test ran.
      setLoad((current) => (current.kind !== 'ready' ? current : {
        kind: 'ready',
        saved: {
          ...current.saved,
          [name]: {
            ...current.saved[name],
            serviceAddresses: { ...current.saved[name].serviceAddresses, ...changed.serviceAddresses },
            credentials: { ...current.saved[name].credentials, ...Object.fromEntries(Object.keys(changed.credentials ?? {}).map((key) => [key, true])) },
          },
        },
      }));
      setChecks((current) => ({ ...current, [name]: { ...result, at: Date.now(), ofSaved: true } }));
      clearForm(name);
      // Names saved services only, never a count, so the wording does not depend on which optional services the owner chose.
      // Read from the ref: a service saved earlier in the same run of Connects is missing from this render's `saved`.
      const latest = loadRef.current.kind === 'ready' ? loadRef.current.saved : saved;
      const silent = services
        .filter((other) => other.name !== name && isConfigured(latest[other.name]) && checksRef.current[other.name].kind !== 'ok')
        .map((other) => other.label);
      toasts.add({
        title: `${info.label} connected${result.version === undefined ? '' : ` · ${result.version}`}`,
        description: `Tested, then saved. ${silent.length === 0 ? 'All saved connections answer.' : `${list(silent)} ${silent.length === 1 ? "doesn't" : "don't"} answer.`}`,
      });
      return true;
    } finally {
      connecting.current.delete(name);
      setPending((current) => ({ ...current, [name]: undefined }));
    }
  };

  /** Tests the Plex address with the token from the owner's Plex sign-in; the server saves both only when the test passes. True once saved. */
  const connectPlexWithSignIn = async () => {
    if (connecting.current.has('plex')) return false;
    connecting.current.add('plex');
    const address = draftOf('plex').address.trim();
    const previous = checksRef.current.plex;
    setPending((current) => ({ ...current, plex: 'connect' }));
    setChecks((current) => ({ ...current, plex: { kind: 'testing' } }));
    setProblems((current) => ({ ...current, plex: undefined }));
    const fail = (problem: string) => {
      setChecks((current) => ({ ...current, plex: previous }));
      setProblems((current) => ({ ...current, plex: problem }));
      return false;
    };
    try {
      const response = await fetch('/api/setup/plex', { method: 'POST', credentials: 'same-origin', headers: writeHeaders, body: JSON.stringify({ url: address }) });
      if (response.status === 401) {
        unauthorizedRef.current();
        return false;
      }
      if (response.status === 409) return fail('Your sign-in has no Plex token to use. Sign out and sign in again, or paste a token.');
      if (response.status !== 200) return fail('The test could not reach media-manager-2. Try again.');
      const result = await response.json() as TestResult;
      setChecks((current) => ({ ...current, plex: afterTest(previous, result, Date.now(), result.kind === 'ok').check }));
      if (result.kind !== 'ok') return false;
      setLoad((current) => (current.kind !== 'ready' ? current : {
        kind: 'ready',
        saved: {
          ...current.saved,
          plex: {
            ...current.saved.plex,
            serviceAddresses: { ...current.saved.plex.serviceAddresses, 'plex.url': address },
            credentials: { ...current.saved.plex.credentials, 'plex.token': true },
          },
        },
      }));
      clearForm('plex');
      setPlexSignIn(true);
      toasts.add({ title: `Plex connected${result.version === undefined ? '' : ` · ${result.version}`}`, description: 'Tested with your sign-in token, then saved.' });
      return true;
    } catch {
      return fail('The test could not reach media-manager-2. Try again.');
    } finally {
      connecting.current.delete('plex');
      setPending((current) => ({ ...current, plex: undefined }));
    }
  };

  const checkSaved = async (name: ServiceName) => {
    setPending((current) => ({ ...current, [name]: 'check' }));
    await test(name, {}, true);
    setPending((current) => ({ ...current, [name]: undefined }));
  };

  const discard = (name: ServiceName) => {
    const check = checks[name];
    clearForm(name);
    // A failure of the discarded values says nothing about the saved ones.
    if ('at' in check && !check.ofSaved) {
      if (isConfigured(saved?.[name])) void checkSaved(name);
      else setChecks((current) => ({ ...current, [name]: { kind: 'idle' } }));
    }
  };

  const setDraft = (name: ServiceName, draft: Draft) => {
    if (draft.address !== draftOf(name).address) setDifferentServers((current) => ({ ...current, [name]: undefined }));
    setDrafts((current) => ({ ...current, [name]: draft }));
  };

  const setReplacingKey = (name: ServiceName, key: string, value: boolean) => {
    setReplacing((current) => ({ ...current, [key]: value }));
    if (!value) setDrafts((current) => {
      const draft = current[name] ?? emptyDraft(saved?.[name]);
      return { ...current, [name]: { ...draft, secrets: Object.fromEntries(Object.entries(draft.secrets).filter(([secret]) => secret !== key)) } };
    });
  };

  const choosePlexSignIn = (on: boolean) => {
    setPlexSignIn(on);
    // A token typed under "Paste a token" would otherwise still count as an unsaved edit once its field is hidden.
    if (on) setDrafts((current) => ({ ...current, plex: { ...(current.plex ?? emptyDraft(saved?.plex)), secrets: {} } }));
  };

  return {
    load, setLoad, saved, checks, replacing, pending, problems, differentServers,
    read, draftOf, editedOf, usingSignIn, connect, connectPlexWithSignIn, checkSaved, discard, setDraft, setReplacingKey, choosePlexSignIn,
  };
}
