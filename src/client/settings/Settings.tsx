import { ArrowLeft, ArrowRight, ChevronRight, DatabaseBackup, Folder, Globe, Lock, Plug, Plus, RefreshCw, ShieldCheck, Undo2 } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { OptionRow } from '@/components/ui/option-row';
import { BarBottomAction } from '@/components/ui/bar-bottom-action';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FactRow } from '@/components/ui/fact';
import { FieldLabelled } from '@/components/ui/field-labelled';
import { HeaderPage } from '@/components/ui/header-page';
import { InputSearch } from '@/components/ui/input-search';
import { LabelGroup } from '@/components/ui/label-group';
import { Logo } from '@/components/ui/logo';
import { Radio, RadioGroup } from '@/components/ui/radio';
import { RowService } from '@/components/ui/row-service';
import { SkeletonRowTwoLine } from '@/components/ui/skeleton';
import { type ServiceState, StatusServicePill } from '@/components/ui/status-service-pill';
import { useToastManager } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import {
  ago, chain, changedCount, changes, type Check, type Draft, failureTitle, fieldWords, headerSummary, isConfigured, linkTone, pillFor,
  savedAddress, type SavedService, type ServiceInfo, type ServiceName, services,
} from './model';
import { BackupEditor } from './BackupEditor';
import { FoldersEditor } from './FoldersEditor';
import { backupPill, backupWords, type SetupStatus } from './setup';
import { infoOf, requester, useServices } from './useServices';
import { AddTracker, TrackerEditor, TrackerListRow, TrackerPill } from './TrackerEditor';
import { draftFromRow, isEdited, type RuleDraft, softwareLabels, trackerInfo, type TrackerRow, trackerSummary } from './trackers';

// A service, a tracker as `tracker:<host>`, the add-a-tracker pane, Folders or Backup.
type Selected = ServiceName | `tracker:${string}` | 'add' | 'folders' | 'backup';
const trackerKey = (host: string): Selected => `tracker:${host}`;

const failed = (check: Check) => check.kind === 'unreachable' || check.kind === 'rejected' || check.kind === 'not_configured';
const timeOf = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
// The pill's own logo and name are off here: its first two children are hidden, the dot stays.
const pillOnly = '[&>span:nth-child(-n+2)]:hidden';

/** What changed, in words: "address and API key", "address" or "API key". */
const changedWords = (info: ServiceInfo, saved: SavedService | undefined, draft: Draft) => {
  const changed = changes(info.name, saved, draft);
  const address = changed.serviceAddresses !== undefined;
  const secret = changed.credentials !== undefined;
  return { words: address && secret ? `address and ${info.refused}` : address ? 'address' : info.refused, plural: address && secret };
};

export function Settings({ onUnauthenticated }: { onUnauthenticated: () => void }) {
  const connections = useServices(onUnauthenticated);
  const { load, setLoad, checks, replacing, pending, problems, draftOf, editedOf } = connections;
  const [selected, setSelected] = useState<Selected>('sonarr');
  const [trackers, setTrackers] = useState<TrackerRow[]>([]);
  const [checkedAt, setCheckedAt] = useState<Record<string, number>>({});
  const [ruleDrafts, setRuleDrafts] = useState<Record<string, RuleDraft>>({});
  const [newAddress, setNewAddress] = useState('');
  const [discardOpen, setDiscardOpen] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [setup, setSetup] = useState<SetupStatus>();
  const toasts = useToastManager();
  const unauthorizedRef = useRef(onUnauthenticated);
  unauthorizedRef.current = onUnauthenticated;
  const readServices = connections.read;

  useEffect(() => {
    const handle = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(handle);
  }, []);

  const request = useMemo(() => requester('/api/settings/trackers', () => unauthorizedRef.current()), []);
  const setupRequest = useMemo(() => requester('/api/setup', () => unauthorizedRef.current()), []);

  /** Reads what /api/setup reports: whether the folders are saved, the backup destination and BACKUP_KEY, and the Plex sign-in token. */
  const readSetup = useCallback(async () => {
    const response = await fetch('/api/setup', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (response.status === 401) {
      unauthorizedRef.current();
      throw new Error('Signed out.');
    }
    if (!response.ok) throw new Error('Setup status could not be read.');
    setSetup(await response.json() as SetupStatus);
  }, []);

  /** Reads every tracker row; the server checks each account connection, reusing a result up to 5 minutes old. */
  const readTrackers = useCallback(async () => {
    const response = await request('GET', '');
    if (!response.ok) throw new Error('Trackers could not be read.');
    const rows = await response.json() as TrackerRow[];
    const at = Date.now();
    setTrackers(rows);
    setCheckedAt(Object.fromEntries(rows.map((row) => [row.host, at])));
    return rows;
  }, [request]);

  const read = useCallback(async () => {
    setLoad({ kind: 'loading' });
    try {
      await Promise.all([readServices(), readTrackers(), readSetup()]);
    } catch {
      setLoad({ kind: 'failed' });
    }
  }, [setLoad, readServices, readTrackers, readSetup]);

  useEffect(() => { void read(); }, [read]);

  if (load.kind !== 'ready' || setup === undefined) {
    return (
      <div className="flex flex-col gap-6 pt-2 pb-6">
        <HeaderPage title="Settings" />
        {load.kind === 'failed'
          ? <Callout title="Settings could not be read" action={<Button variant="outline" icon={<RefreshCw />} onClick={() => void read()}>Retry</Button>}>Check that media-manager-2 is running, then retry.</Callout>
          : <div className="w-105">{services.slice(0, 4).map((info) => <SkeletonRowTwoLine key={info.name} />)}</div>}
      </div>
    );
  }

  const { saved } = load;
  const usingSignIn = connections.usingSignIn(setup.plexSignInTokenAvailable);
  const edited = services.filter((info) => editedOf(info.name) > 0).map((info) => info.name);
  const anyConfigured = services.some((info) => isConfigured(saved[info.name]));
  const testing = services.some((info) => checks[info.name].kind === 'testing');
  const times = services.flatMap((info) => { const check = checks[info.name]; return 'at' in check ? [check.at] : []; });
  const lastChecked = !testing && times.length > 0 ? ago(Math.max(...times), now) : undefined;

  const discard = (name: ServiceName) => {
    setDiscardOpen(false);
    connections.discard(name);
  };

  // The service pane shows the selected service, or keeps Sonarr's state when anything else is selected.
  const service = (services.some((member) => member.name === selected) ? selected : 'sonarr') as ServiceName;
  const selectedTracker = trackers.find((tracker) => trackerKey(tracker.host) === selected);
  const info = infoOf(service);
  const others = services.filter((other) => other.name !== service && (checks[other.name].kind === 'unreachable' || checks[other.name].kind === 'rejected'));
  const discardWords = changedWords(info, saved[service], draftOf(service));
  const ruleDraftOf = (row: TrackerRow) => ruleDrafts[row.host] ?? draftFromRow(row);
  const adding = selected === 'add';
  const storage = selected === 'folders' || selected === 'backup';
  const storageConfigured = (setup.required.folders === 'done' ? 1 : 0) + (setup.backup.destination !== null ? 1 : 0);
  const backupState = backupPill(setup.backup);

  // Merged into the latest row, so a rule saved while a connection test ran is kept.
  const updateTracker = (host: string, change: Partial<TrackerRow>, at: number) => {
    setTrackers((current) => current.map((row) => (row.host === host ? { ...row, ...change } : row)));
    setCheckedAt((current) => ({ ...current, [host]: at }));
  };
  const dropRuleDraft = (host: string) => setRuleDrafts((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== host)));
  /** Reads the trackers again; a failed read keeps the rows on screen and says so. */
  const rereadTrackers = async () => {
    try {
      return await readTrackers();
    } catch {
      toasts.add({ title: 'Trackers could not be read', description: 'Check that media-manager-2 is running, then open Settings again.' });
      return undefined;
    }
  };
  const rereadSetup = async () => {
    try {
      await readSetup();
    } catch {
      toasts.add({ title: 'Settings could not be re-read', description: 'Open Settings again to see what is saved.' });
    }
  };

  const trackerRow = (row: TrackerRow) => {
    const { name, named } = trackerInfo(row.host);
    return (
      <TrackerListRow
        key={row.host}
        host={row.host}
        title={name}
        subline={named ? row.host : softwareLabels[row.software]}
        pill={<TrackerPill row={row} edited={isEdited(ruleDraftOf(row), row)} />}
        selected={selected === trackerKey(row.host)}
        onClick={() => setSelected(trackerKey(row.host))}
      />
    );
  };

  const row = (other: ServiceInfo) => {
    const pill = pillFor(other, checks[other.name], editedOf(other.name));
    if (other.logo === null || other.addressPlaceholder === undefined) {
      return (
        <TrackerListRow
          key={other.name}
          host=""
          title={other.label}
          subline={isConfigured(saved[other.name]) ? `${other.refused} saved` : <span className="text-subtle-foreground">No {other.refused} yet</span>}
          icon={other.logo === null ? <Globe /> : <Logo name={other.logo} alt="" />}
          pill={<StatusServicePill logo={null} name={null} state={pill.state} className={pillOnly}>{pill.text}</StatusServicePill>}
          selected={other.name === selected}
          onClick={() => setSelected(other.name)}
        />
      );
    }
    const address = savedAddress(saved[other.name]) || draftOf(other.name).address.trim();
    return (
      <RowService
        key={other.name}
        logo={other.logo}
        name={other.label}
        address={address === '' ? <span className="text-subtle-foreground">No address yet</span> : address}
        state={pill.state}
        stateText={pill.text}
        selected={other.name === selected}
        onClick={() => setSelected(other.name)}
      />
    );
  };
  const group = (title: string, members: ServiceInfo[], first: boolean) => {
    const configured = members.filter((member) => isConfigured(saved[member.name])).length;
    return (
      <>
        <LabelGroup className={cn(first && 'pt-0')} count={configured === members.length ? members.length : `${configured} of ${members.length}`}>{title}</LabelGroup>
        {members.map(row)}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-6 pt-2 pb-6">
      <HeaderPage
        title="Settings"
        summary={headerSummary(checks, edited, lastChecked, trackerSummary(trackers, adding))}
        note={anyConfigured ? undefined : 'Nothing is connected yet. Add each service’s address and key, then Connect tests and saves it.'}
      />

      <PiecesStrip
        checks={checks}
        editedOf={editedOf}
        folders={setup.required.folders === 'done' ? { state: 'connected', text: 'Saved' } : { state: 'not-set-up', text: 'Not set up' }}
      />

      <div className="flex items-start gap-8">
        <nav aria-label="Services" className="flex w-105 shrink-0 flex-col">
          {group('Services', services.filter((member) => member.group === 'Services'), true)}
          {group('Metadata', services.filter((member) => member.group === 'Metadata'), false)}
          <LabelGroup count={storageConfigured === 2 ? 2 : `${storageConfigured} of 2`}>Storage</LabelGroup>
          <TrackerListRow
            host=""
            title="Folders"
            subline="Downloads, libraries and second versions"
            icon={<Folder />}
            pill={setup.required.folders === 'done'
              ? <StatusServicePill logo={null} name={null} state="connected" className={pillOnly}>Saved</StatusServicePill>
              : <StatusServicePill logo={null} name={null} state="not-set-up" className={pillOnly}>Not set up</StatusServicePill>}
            selected={selected === 'folders'}
            onClick={() => setSelected('folders')}
          />
          <TrackerListRow
            host=""
            title="Backup"
            subline={backupWords(setup.backup.destination) ?? <span className="text-subtle-foreground">No destination yet</span>}
            icon={<DatabaseBackup />}
            pill={<StatusServicePill logo={null} name={null} state={backupState.state} className={pillOnly}>{backupState.text}</StatusServicePill>}
            selected={selected === 'backup'}
            onClick={() => setSelected('backup')}
          />
          <LabelGroup count={adding ? undefined : trackers.length}>Trackers</LabelGroup>
          {trackers.map(trackerRow)}
          {adding && (
            <TrackerListRow
              host=""
              adding
              title="New tracker"
              subline={newAddress.trim() === '' ? <span className="text-subtle-foreground">No address yet</span> : newAddress.trim()}
              selected
              onClick={() => undefined}
            />
          )}
          {trackers.length === 0 && !adding && (
            <div className="rounded-lg border border-border">
              <EmptyState
                icon={<ShieldCheck />}
                title="No trackers added"
                action={<Button icon={<Plus />} className="mt-2" onClick={() => setSelected('add')}>Add tracker</Button>}
              >
                Add each tracker you use. Its hit and run rule decides when a torrent is safe to remove. Until a tracker has a rule, every torrent from it keeps seeding.
              </EmptyState>
            </div>
          )}
          {trackers.length > 0 && !adding && (
            <div className="px-4 py-2">
              <Button variant="outline" size="row" icon={<Plus />} onClick={() => { setNewAddress(''); setSelected('add'); }}>Add tracker</Button>
            </div>
          )}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {adding ? (
            <AddTracker
              address={newAddress}
              onAddress={setNewAddress}
              request={request}
              onCancel={() => setSelected(trackers[0] === undefined ? 'sonarr' : trackerKey(trackers[0].host))}
              onAdded={async (host, softwareSaved) => {
                setNewAddress('');
                await rereadTrackers();
                setSelected(trackerKey(host));
                if (!softwareSaved) toasts.add({ title: `${trackerInfo(host).name} added as Other`, description: 'Its site software could not be saved. Remove it and add it again to pick the software.' });
              }}
            />
          ) : selected === 'folders' ? (
            <FoldersEditor
              key="folders"
              request={setupRequest}
              onSaved={() => {
                void rereadSetup();
                toasts.add({ title: 'Folders saved' });
              }}
            />
          ) : selected === 'backup' ? (
            <BackupEditor
              // Keyed by the destination only, so the re-read after a key is created keeps the restore key on screen.
              key={JSON.stringify(setup.backup.destination)}
              backup={setup.backup}
              request={setupRequest}
              onSaved={() => {
                void rereadSetup();
                toasts.add(setup.backup.key === 'missing' || setup.backup.key === 'invalid'
                  ? { title: 'Destination saved', description: 'Create a key so backups can run.' }
                  : { title: 'Backups on', description: 'Every 5 minutes, to the destination you confirmed.' });
              }}
              onKeyCreated={() => void rereadSetup()}
            />
          ) : selectedTracker !== undefined ? (
            <TrackerEditor
              key={selectedTracker.host}
              row={selectedTracker}
              draft={ruleDraftOf(selectedTracker)}
              checkedAt={checkedAt[selectedTracker.host]}
              now={now}
              request={request}
              onDraft={(draft) => (draft === undefined
                ? dropRuleDraft(selectedTracker.host)
                : setRuleDrafts((current) => ({ ...current, [selectedTracker.host]: draft })))}
              onRow={updateTracker}
              onRuleSaved={async () => {
                if (await rereadTrackers() !== undefined) dropRuleDraft(selectedTracker.host);
              }}
              onRemoved={async () => {
                dropRuleDraft(selectedTracker.host);
                const rows = await rereadTrackers();
                setSelected(rows?.[0] === undefined ? 'sonarr' : trackerKey(rows[0].host));
              }}
            />
          ) : (
            <Editor
              key={service}
              info={info}
              saved={saved[service]}
              draft={draftOf(service)}
              check={checks[service]}
              pending={pending[service]}
              problem={problems[service]}
              replacing={replacing}
              now={now}
              onDraft={(draft) => connections.setDraft(service, draft)}
              onReplacing={(key, value) => connections.setReplacingKey(service, key, value)}
              signInToken={info.name === 'plex' && setup.plexSignInTokenAvailable ? { on: usingSignIn, onChange: connections.choosePlexSignIn } : undefined}
              onConnect={() => void (info.name === 'plex' && usingSignIn ? connections.connectPlexWithSignIn() : connections.connect(service))}
              onCheck={() => void connections.checkSaved(service)}
              onDiscard={() => setDiscardOpen(true)}
            />
          )}
          {others.length > 0 && !adding && selectedTracker === undefined && !storage && (
            <Callout title={failureTitle(others[0], checks[others[0].name], '')}>
              {[
                checks[others[0].name].kind === 'unreachable'
                  ? (others[0].addressPlaceholder === undefined ? `Check that the seedbox can reach ${others[0].label} over the internet.` : `Check that ${others[0].label} is running and that its address is right.`)
                  : `Open ${others[0].label} and enter a new ${others[0].refused}.`,
                ...others.slice(1).map((other) => (checks[other.name].kind === 'unreachable'
                  ? `${other.label} also failed: no answer within 10 seconds.`
                  : `${other.label} also failed: it refused the ${other.refused}.`)),
              ].join(' ')}
            </Callout>
          )}
        </div>
      </div>

      <Dialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={`Discard edits to ${info.label}?`}
        subject={`The new ${discardWords.words} ${discardWords.plural ? 'are' : 'is'} not saved. ${isConfigured(saved[service])
          ? `${info.label} keeps its current connection.`
          : `${info.label} stays not set up.`}`}
        actions={(
          <>
            <Button variant="outline" size="large" onClick={() => setDiscardOpen(false)}>Keep editing</Button>
            <Button variant="destructive" size="large" onClick={() => discard(service)}>Discard</Button>
          </>
        )}
      />
    </div>
  );
}

type PiecesStripProps = {
  checks: Record<ServiceName, Check>;
  editedOf: (name: ServiceName) => number;
  /** Folders sits under rTorrent. */
  folders: { state: ServiceState; text: string };
  /** The setup wizard's lit pills: black with a lime dot, all lime once setup is done. */
  look?: 'plain' | 'setup' | 'done';
};

/** The "How the pieces connect" strip: each service column with the links between them. Pills in a column share the widest one's width. */
export function PiecesStrip({ checks, editedOf, folders, look = 'plain' }: PiecesStripProps) {
  const done = look === 'done';
  const pillLook = look === 'setup' ? 'dark' : done ? 'lime' : 'plain';
  const caption = 'font-ui text-[11px] font-semibold tracking-[0.5px] text-subtle-foreground uppercase';
  return (
    <section aria-labelledby="pieces-title" className="flex flex-col">
      <LabelGroup id="pieces-title" className="pt-0">How the pieces connect</LabelGroup>
      <div className={cn('flex items-center rounded-lg border px-6 py-5 transition-colors duration-(--duration-base) ease-out', done ? 'border-bar bg-bar' : 'border-border')}>
        <div className="flex min-w-0 flex-1 gap-3">
          {chain.map((column, index) => {
            const next = chain[index + 1];
            const tone = next === undefined ? 'idle' : linkTone(column.names.map((name) => checks[name]), next.names.map((name) => checks[name]));
            return (
              <Fragment key={column.caption}>
                {/* A floor wide enough for "Connected · 4.0.10", so a pill changing state does not reflow the strip. */}
                <div className="flex min-w-48 shrink-0 flex-col gap-2">
                  <h3 className={caption}>{column.caption}</h3>
                  <div className="flex h-23.5 flex-col items-stretch justify-center gap-2">
                    {column.names.map((name) => {
                      const member = infoOf(name);
                      const pill = pillFor(member, checks[name], editedOf(name));
                      return <StatusServicePill key={name} look={pillLook} logo={member.logo === null ? null : <Logo name={member.logo} alt="" />} name={member.label} state={pill.state}>{pill.text}</StatusServicePill>;
                    })}
                    {column.names.includes('rtorrent') && (
                      <StatusServicePill look={pillLook} logo={<Folder aria-hidden="true" className={cn('size-4', pillLook === 'dark' && folders.state === 'connected' ? 'text-bar-foreground' : 'text-foreground')} />} name="Folders" state={folders.state}>
                        {folders.text}
                      </StatusServicePill>
                    )}
                  </div>
                </div>
                {column.linked && (
                  <div
                    aria-hidden="true"
                    className={cn(
                      'flex h-29.25 min-w-4 flex-1 items-center pt-5.75',
                      done ? 'text-bar-foreground' : tone === 'risk' ? 'text-destructive' : tone === 'ok' ? 'text-input' : 'text-border',
                    )}
                  >
                    <span className="h-px flex-1 bg-current" />
                    <ChevronRight className="size-3.5 shrink-0" />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type EditorProps = {
  info: ServiceInfo;
  saved: SavedService;
  draft: Draft;
  check: Check;
  pending: 'connect' | 'check' | undefined;
  problem: string | undefined;
  replacing: Record<string, boolean>;
  now: number;
  onDraft: (draft: Draft) => void;
  onReplacing: (key: string, value: boolean) => void;
  onConnect: () => void;
  onCheck: () => void;
  onDiscard: () => void;
  signInToken?: { on: boolean; onChange: (on: boolean) => void };
  /** The setup wizard's step: its heading and count, the step Connect moves on to, Back in place of Discard and Check now, and wording that replaces the address's or a credential's (keyed by 'address' or the credential key). */
  wizard?: { title: string; step: string; next: string; onBack: () => void; hints?: Record<string, { label?: string; placeholder?: string; help?: string }> };
};

/** The pane for the selected service. Switching services crossfades it (duration-base, ease-out). */
export function Editor({ info, saved, draft, check, pending, problem, replacing, now, onDraft, onReplacing, onConnect, onCheck, onDiscard, signInToken, wizard }: EditorProps) {
  const configured = isConfigured(saved);
  const edits = changedCount(info.name, saved, draft);
  const testing = check.kind === 'testing';
  const formFailed = failed(check) && 'at' in check && !check.ofSaved;
  const pill = pillFor(info, check, edits, true);
  const savedUrl = savedAddress(saved);
  const address = draft.address.trim();
  const typedSecret = Object.values(draft.secrets).some((value) => value.trim() !== '');
  const anySecretSaved = Object.values(saved.credentials).some(Boolean);
  const words = changedWords(info, saved, draft).words;
  const inputs = useRef<Record<string, HTMLElement | null>>({});
  const signIn = signInToken?.on === true;

  const signInSummary = testing ? `Testing ${address || info.label} with your sign-in token. Takes up to 10 seconds.`
    : formFailed ? 'The test failed, so nothing was saved.'
      : 'Connect tests the address with your sign-in token, then saves both. If the test fails, nothing changes.';
  const summary = signIn ? signInSummary : testing
    ? `Testing ${address || info.label}${typedSecret ? ` with this ${info.refused}` : anySecretSaved ? ` with the saved ${info.refused}` : ''}. Takes up to 10 seconds.`
    : formFailed && edits > 0 ? 'The test failed, so nothing was saved.'
      : edits > 0 ? `Connect tests the new ${words}, then saves. If the test fails, nothing changes.`
        : !configured ? `Connect tests the ${fieldWords(info)}, then saves.`
          : 'Nothing to save. Change a field and Connect tests it before saving.';
  // In the wizard a saved service with nothing changed moves on without a new test.
  const unchanged = configured && edits === 0 && !signIn;
  const wizardSummary = wizard === undefined || testing || formFailed ? summary
    : unchanged ? `${info.label} is saved. Continue moves on to ${wizard.next}.`
      : signIn ? `Connect tests the address with your sign-in token, saves both, then moves on to ${wizard.next}.`
        : `Connect tests the ${edits > 0 ? `new ${words}` : fieldWords(info)}, saves them, then moves on to ${wizard.next}.`;

  return (
    <section
      aria-labelledby={`${info.name}-editor`}
      className="flex flex-col gap-6 rounded-lg border border-border p-6 transition-opacity duration-(--duration-base) ease-out starting:opacity-0"
    >
      <div className="flex items-center gap-3">
        {info.logo === null
          ? <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground [&>svg]:size-4"><Globe /></span>
          : <Logo name={info.logo} alt="" className="size-8" />}
        <h2 id={`${info.name}-editor`} className="font-ui text-base font-bold text-foreground">{wizard?.title ?? info.label}</h2>
        <StatusServicePill logo={null} name={null} state={pill.state} className={pillOnly}>{pill.text}</StatusServicePill>
        {wizard !== undefined && <span className="ml-auto font-data text-[13px] text-muted-foreground">{wizard.step}</span>}
      </div>

      {signInToken !== undefined && (
        <RadioGroup
          aria-label="Plex token"
          className="grid grid-cols-2 gap-2"
          value={signIn ? 'signIn' : 'paste'}
          onValueChange={(value) => signInToken.onChange(value === 'signIn')}
        >
          <OptionRow
            control={<Radio value="signIn" disabled={testing} />}
            title="Use my sign-in token"
            description="The token from your Plex sign-in. Nothing to paste."
            bordered
          />
          <OptionRow
            control={<Radio value="paste" disabled={testing} />}
            title="Paste a token"
            description="The X-Plex-Token of your Plex server."
            bordered
          />
        </RadioGroup>
      )}

      <div className="grid grid-cols-2 gap-4">
        {info.addressPlaceholder !== undefined && <FieldLabelled
          label={wizard?.hints?.address?.label ?? 'Address'}
          error={check.kind === 'unreachable' ? 'Nothing answered at this address within 10 seconds. Check the port.' : undefined}
          help={savedUrl !== '' && address !== savedUrl
            ? <span className="text-muted-foreground">Changed from {savedUrl}. Not saved yet.</span>
            : wizard?.hints?.address?.help ?? `Where media-manager-2 reaches ${info.label} on the seedbox, with the port.`}
        >
          <InputSearch
            variant="field"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder={info.addressPlaceholder}
            value={draft.address}
            readOnly={testing}
            aria-invalid={check.kind === 'unreachable' || undefined}
            onValueChange={(value) => onDraft({ ...draft, address: value })}
          />
        </FieldLabelled>}
        {!signIn && info.credentials.map((credential, index) => {
          const isSaved = saved.credentials[credential.key] === true;
          const locked = isSaved && !replacing[credential.key];
          const typed = (draft.secrets[credential.key] ?? '').trim() !== '';
          const refused = check.kind === 'rejected' && index === 0;
          const hint = wizard?.hints?.[credential.key];
          const help = hint?.help ?? credential.help;
          return (
            <FieldLabelled
              key={credential.key}
              label={credential.label}
              error={refused ? `${info.label} refused this ${info.refused}.` : undefined}
              help={typed
                ? <span className="text-muted-foreground">New {credential.short}, not saved yet. {help}</span>
                : locked ? `Saved. ${help}` : help}
              action={isSaved && (
                <Button
                  variant="outline"
                  disabled={testing}
                  onClick={() => {
                    onReplacing(credential.key, locked);
                    if (locked) window.requestAnimationFrame(() => inputs.current[credential.key]?.focus());
                  }}
                >
                  {locked ? 'Replace' : `Keep saved ${credential.short}`}
                </Button>
              )}
            >
              {locked
                // The key makes React build a new input, so a typed secret never lingers in the locked one.
                ? <InputSearch key="locked" variant="field" readOnly value="" icon={<Lock aria-hidden="true" />} placeholder="••••••••••••••••••••" wrapperClassName="bg-muted" />
                : (
                  <InputSearch
                    key="open"
                    variant="field"
                    type={credential.secret ? 'password' : 'text'}
                    autoComplete="off"
                    spellCheck={false}
                    ref={(element) => { inputs.current[credential.key] = element; }}
                    placeholder={hint?.placeholder ?? credential.placeholder}
                    value={draft.secrets[credential.key] ?? ''}
                    readOnly={testing}
                    aria-invalid={refused || undefined}
                    onValueChange={(value) => onDraft({ ...draft, secrets: { ...draft.secrets, [credential.key]: value } })}
                  />
                )}
            </FieldLabelled>
          );
        })}
      </div>

      <dl className="flex flex-col">
        {check.kind === 'ok' && check.version !== undefined && <FactRow label="Version">{check.version}</FactRow>}
        {'at' in check && check.ofSaved && (
          <FactRow label="Last checked" note={`${ago(check.at, now)}${edits > 0 && check.ofSaved ? `, with the saved ${fieldWords(info)}` : ''}`}>
            Today {timeOf(check.at)}
          </FactRow>
        )}
        <FactRow label="Used for">{info.usedFor}</FactRow>
      </dl>

      <BarBottomAction
        summary={wizardSummary}
        unsavedNote={edits > 0 && !testing && !formFailed ? 'Unsaved edits' : undefined}
        secondary={wizard !== undefined ? <Button variant="outline" icon={<ArrowLeft />} disabled={testing} onClick={wizard.onBack}>Back</Button>
          : edits > 0 || (testing && pending === 'connect')
            ? <Button variant="outline" icon={<Undo2 />} disabled={testing} onClick={onDiscard}>Discard edits</Button>
            : configured && <Button variant="ghost" icon={<RefreshCw />} loading={pending === 'check'} disabled={testing && pending !== 'check'} onClick={onCheck}>Check now</Button>}
        action={(
          <Button
            size="large"
            icon={wizard !== undefined && unchanged ? <ArrowRight /> : <Plug />}
            loading={pending === 'connect'}
            disabled={signIn ? address === '' || (testing && pending !== 'connect') : (wizard === undefined && configured && edits === 0) || (testing && pending !== 'connect')}
            onClick={onConnect}
          >
            {pending === 'connect' ? 'Testing…' : wizard === undefined ? 'Connect' : unchanged ? 'Continue' : 'Connect and continue'}
          </Button>
        )}
      />

      {problem !== undefined && <Callout title={problem} />}
      {problem === undefined && failed(check) && 'at' in check && (
        <Callout
          title={failureTitle(info, check, address || savedUrl)}
          action={<Button variant="outline" icon={<RefreshCw />} onClick={signIn || edits > 0 || !configured ? onConnect : onCheck}>Try again</Button>}
        >
          {check.kind === 'unreachable'
            ? (info.addressPlaceholder === undefined ? `Check that the seedbox can reach ${info.label} over the internet.` : `Check that ${info.label} is running and that the port is right.`)
            : check.kind === 'rejected' ? (signIn ? 'Plex refused your sign-in token. Check that this is your own Plex server, or paste a token instead.' : info.credentials[0].help) : `Fill in the ${fieldWords(info)}, then Connect again.`}
          {!check.ofSaved && check.kind !== 'not_configured' ? (signIn ? ' The address above is kept so you can fix it.' : (info.addressPlaceholder === undefined ? ` The ${info.refused} above is kept so you can fix it.` : ` The address and ${info.refused} above are kept so you can fix them.`)) : ''}
        </Callout>
      )}
    </section>
  );
}
