import { ArrowLeft, ArrowRight, CircleCheck, DatabaseBackup, Folder, Globe, Library, ListChecks, Lock, Plus, RefreshCw, ShieldCheck, Star } from 'lucide-react';
import { type ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppBarDesktop } from '@/components/ui/app-bar';
import { BarBottomAction } from '@/components/ui/bar-bottom-action';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Checkbox } from '@/components/ui/checkbox';
import { FactRow } from '@/components/ui/fact';
import { FieldLabelled } from '@/components/ui/field-labelled';
import { HeaderPage } from '@/components/ui/header-page';
import { InputSearch } from '@/components/ui/input-search';
import { LabelGroup } from '@/components/ui/label-group';
import { Logo } from '@/components/ui/logo';
import { OptionRow } from '@/components/ui/option-row';
import { RowService } from '@/components/ui/row-service';
import { SkeletonRowTwoLine } from '@/components/ui/skeleton';
import { type ServiceState, StatusServicePill } from '@/components/ui/status-service-pill';
import { useToastManager } from '@/components/ui/toast';
import { navigate } from '../navigation';
import { BackupEditor } from './BackupEditor';
import { FoldersEditor } from './FoldersEditor';
import { JellyfinEditor } from './JellyfinEditor';
import { isConfigured, list, pillFor, savedAddress, type ServiceName, services } from './model';
import { Editor, PiecesStrip, touchInputs } from './Settings';
import {
  backupPill, backupWords, firstStep, nextStep, type OptionalPart, previousStep, type RequiredPart, requiredParts, type RtorrentSuggestion, type SetupStatus, wantedParts, type WizardStep, wizardSummary,
} from './setup';
import { AddTracker, TrackerEditor, TrackerListRow, TrackerPill } from './TrackerEditor';
import { draftFromRow, isEdited, type RuleDraft, trackerInfo, type TrackerRow } from './trackers';
import { infoOf, requester, useServices } from './useServices';

// The pill's own logo and name are off here: its first two children are hidden, the dot stays.
const pillOnly = '[&>span:nth-child(-n+2)]:hidden';
const pill = (state: ServiceState, text: string) => <StatusServicePill logo={null} name={null} state={state} className={pillOnly}>{text}</StatusServicePill>;
type ServiceStep = Exclude<RequiredPart, 'folders' | 'mediaServer'>;
const serviceSteps: { name: ServiceStep; about: string; needs: string }[] = [
  { name: 'sonarr', about: 'TV shows', needs: 'Address and API key, from Sonarr\'s Settings > General' },
  { name: 'radarr', about: 'Movies', needs: 'Address and API key, from Radarr\'s Settings > General' },
  { name: 'rtorrent', about: 'Downloads', needs: 'Password. The address and username come from Sonarr' },
];
// The media-server step follows the owner's pick on the first-run page.
const mediaNeeds = { plex: 'Address. The token comes from your Plex sign-in', jellyfin: 'API key, from Jellyfin\'s Dashboard > API Keys' };
const stepNames: Record<Exclude<WizardStep, 'mediaServer'>, string> = {
  what: 'What to set up', sonarr: 'Sonarr', radarr: 'Radarr', rtorrent: 'rTorrent', folders: 'Folders', trackers: 'trackers', metadata: 'posters and ratings', backup: 'backup', done: 'the end of setup',
};

type Props = {
  status: SetupStatus;
  headingRef: RefObject<HTMLHeadingElement | null>;
  signOutLabel: string;
  signOutDisabled: boolean;
  signOutProblem: ReactNode;
  onSignOut: () => void;
  onUnauthenticated: () => void;
  /** The owner left Done for the app. */
  onFinished: () => void;
};

/** The first-run setup wizard: the Settings layout with one step per part, shown until the owner leaves Done. */
export function SetupWizard({ status: initial, headingRef, signOutLabel, signOutDisabled, signOutProblem, onSignOut, onUnauthenticated, onFinished }: Props) {
  const connections = useServices(onUnauthenticated);
  const { load, saved, checks, draftOf, editedOf } = connections;
  const [status, setStatus] = useState(initial);
  const [wanted, setWanted] = useState(() => wantedParts(initial));
  const [step, setStep] = useState(() => firstStep(initial, wantedParts(initial)));
  const [trackers, setTrackers] = useState<TrackerRow[]>([]);
  const [checkedAt, setCheckedAt] = useState<Record<string, number>>({});
  const [ruleDrafts, setRuleDrafts] = useState<Record<string, RuleDraft>>({});
  // The trackers step shows the list, the add pane, or one tracker by its host.
  const [trackerView, setTrackerView] = useState<string>('list');
  const [newAddress, setNewAddress] = useState('');
  const [choosing, setChoosing] = useState(false);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [query, setQuery] = useState('');
  const [problem, setProblem] = useState<string>();
  const toasts = useToastManager();
  const unauthorizedRef = useRef(onUnauthenticated);
  unauthorizedRef.current = onUnauthenticated;
  const setupRequest = useMemo(() => requester('/api/setup', () => unauthorizedRef.current()), []);
  const trackerRequest = useMemo(() => requester('/api/settings/trackers', () => unauthorizedRef.current()), []);
  const setupTrackerRequest = useMemo(() => requester('/api/setup/trackers', () => unauthorizedRef.current()), []);
  const { read: readServices, setLoad } = connections;

  const readTrackers = useCallback(async () => {
    const response = await trackerRequest('GET', '');
    if (!response.ok) throw new Error('Trackers could not be read.');
    const rows = await response.json() as TrackerRow[];
    const at = Date.now();
    setTrackers(rows);
    setCheckedAt(Object.fromEntries(rows.map((row) => [row.host, at])));
    return rows;
  }, [trackerRequest]);

  const read = useCallback(async () => {
    setLoad({ kind: 'loading' });
    try {
      await Promise.all([readServices(), readTrackers()]);
    } catch {
      setLoad({ kind: 'failed' });
    }
  }, [setLoad, readServices, readTrackers]);

  useEffect(() => { void read(); }, [read]);

  // The rTorrent form starts filled in from Sonarr's download client: asked once, and only while the form is untouched.
  const rtorrentAsked = useRef(false);
  const [rtorrentSuggestion, setRtorrentSuggestion] = useState<RtorrentSuggestion>();
  const editedOfRef = useRef(editedOf);
  editedOfRef.current = editedOf;
  useEffect(() => {
    if (step !== 'rtorrent' || saved === undefined || isConfigured(saved.rtorrent) || editedOfRef.current('rtorrent') !== 0 || rtorrentAsked.current) return;
    rtorrentAsked.current = true;
    void (async () => {
      try {
        const response = await setupRequest('GET', '/rtorrent');
        if (!response.ok) return;
        const { address, username } = await response.json() as RtorrentSuggestion;
        if (editedOfRef.current('rtorrent') !== 0 || (address === null && username === null)) return;
        connections.setDraft('rtorrent', { address: address ?? '', secrets: username === null ? {} : { 'rtorrent.username': username } });
        setRtorrentSuggestion({ address, username });
      } catch {
        // Nothing to suggest; the owner types the form.
      }
    })();
  }, [step, saved]);

  // A step change unmounts the button that caused it. Focus moves to the new pane's heading, unless the owner picked the
  // step from the list (focus stays there), and the pane scrolls into view when its top is above the screen.
  const paneRef = useRef<HTMLDivElement>(null);
  const firstStepRef = useRef(true);
  useEffect(() => {
    if (firstStepRef.current) {
      firstStepRef.current = false;
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const box = paneRef.current;
      if (box === null) return;
      const active = document.activeElement;
      if (active === null || active === document.body || box.contains(active)) {
        const heading = [...box.querySelectorAll('h2')].find((element) => element.offsetParent !== null);
        if (heading !== undefined) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
      }
      if (box.getBoundingClientRect().top < 0) {
        box.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  /** Reads /api/setup again after a save; undefined, with a toast, when it fails. */
  const refresh = async () => {
    try {
      const response = await setupRequest('GET', '');
      if (!response.ok) throw new Error('Setup status could not be read.');
      const fresh = await response.json() as SetupStatus;
      setStatus(fresh);
      return fresh;
    } catch {
      toasts.add({ title: 'Setup could not be re-read', description: 'What you saved is kept. Try the step again.' });
      return undefined;
    }
  };
  const advance = async (from: WizardStep) => {
    const fresh = await refresh();
    if (fresh !== undefined) setStep(nextStep(from, fresh, wanted));
  };
  const rereadTrackers = async () => {
    try {
      return await readTrackers();
    } catch {
      toasts.add({ title: 'Trackers could not be read', description: 'Check that media-manager-2 is running, then try again.' });
      return undefined;
    }
  };

  /** Saves which optional parts are wanted; `skip` marks one of them skipped. */
  const saveChoices = async (choice: Record<OptionalPart, boolean>, skip?: OptionalPart) => {
    setChoosing(true);
    setProblem(undefined);
    // Skipping one part keeps the others' skips; Start clears them all.
    const part = (name: OptionalPart) => ({ wanted: choice[name], skipped: name === skip || (skip !== undefined && status.optional[name].status === 'skipped') });
    try {
      const response = await setupRequest('PUT', '/choices', { trackers: part('trackers'), metadata: part('metadata'), backup: part('backup') });
      if (response.status !== 204) throw new Error('The choices could not be saved.');
      return true;
    } catch {
      setProblem('Your choices could not be saved. Try again.');
      return false;
    } finally {
      setChoosing(false);
    }
  };
  const skip = async (part: OptionalPart) => {
    if (await saveChoices(wanted, part)) await advance(part);
  };

  const chosen = Object.values(status.optional).some((part) => part.wanted || part.status === 'skipped');
  const doneCount = requiredParts.filter((part) => status.required[part] === 'done').length;
  const requiredStep = (part: RequiredPart) => `Step ${requiredParts.indexOf(part) + 1} of 5 required`;
  const back = () => setStep(previousStep(step));
  const noRule = trackers.filter((row) => row.status === 'no_rule').map((row) => trackerInfo(row.host).name);
  const folders = status.required.folders === 'done' ? { state: 'connected' as const, text: 'Confirmed' } : { state: 'not-set-up' as const, text: 'Not set' };
  const backupSkipped = status.optional.backup.status === 'skipped';
  const backupState = backupPill(status.backup);
  const foldersReady = step === 'folders' || (['sonarr', 'radarr', 'rtorrent'] as const).every((part) => status.required[part] === 'done');
  const metadataServices = services.filter((info) => info.group === 'Metadata');
  const connected = metadataServices.filter((info) => isConfigured(saved?.[info.name]));
  const metadataPill = connected.length > 0 ? pill('connected', `${connected.length} connected`)
    : status.optional.metadata.status === 'skipped' ? pill('not-set-up', 'Skipped') : pill('not-set-up', 'Not set up');

  const jellyfin = status.mediaServer.kind === 'jellyfin' ? status.mediaServer : undefined;
  const mediaLabel = jellyfin === undefined ? 'Plex' : 'Jellyfin';
  const nameOf = (part: WizardStep) => (part === 'mediaServer' ? mediaLabel : stepNames[part]);
  // The media-server step is the Plex service unless the owner picked Jellyfin, which has no entry in the services list.
  const serviceOf = (part: ServiceStep | 'mediaServer'): ServiceName => (part === 'mediaServer' ? 'plex' : part);
  const jellyfinPill = status.required.mediaServer === 'done' ? { state: 'connected' as const, text: 'Connected' } : { state: 'not-set-up' as const, text: 'Needs API key' };

  const connectStep = async (name: ServiceStep | 'mediaServer') => {
    const service = serviceOf(name);
    const signIn = service === 'plex' && connections.usingSignIn(status.plexSignInTokenAvailable);
    if (isConfigured(saved?.[service]) && editedOf(service) === 0 && !signIn) return advance(name);
    if (await (signIn ? connections.connectPlexWithSignIn() : connections.connect(service))) await advance(name);
  };

  const serviceRow = (name: ServiceName, about: string, target: WizardStep) => {
    const member = infoOf(name);
    const state = pillFor(member, checks[name], editedOf(name));
    const address = savedAddress(saved?.[name]);
    return (
      <RowService
        key={target}
        logo={member.logo!}
        name={member.label}
        address={address === '' ? about : address}
        state={state.state}
        stateText={state.text}
        selected={step === target}
        onClick={() => setStep(target)}
      />
    );
  };

  const pane = () => {
    if (step === 'what') {
      const first = nextStep('what', status, wanted);
      return (
        <section aria-labelledby="what-title" className="flex flex-col gap-6 rounded-lg border border-border p-6 transition-opacity duration-(--duration-base) ease-out starting:opacity-0">
          <div className="flex items-center gap-3">
            <ListChecks aria-hidden="true" className="size-6 shrink-0" />
            <h2 id="what-title" className="font-ui text-base font-bold text-foreground">What to set up</h2>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-ui text-sm font-semibold text-foreground">Required before the library opens. Have these ready:</h3>
            <dl className="flex flex-col">
              {serviceSteps.map((service) => <FactRow key={service.name} label={infoOf(service.name).label}>{service.needs}</FactRow>)}
              <FactRow label={mediaLabel}>{mediaNeeds[jellyfin === undefined ? 'plex' : 'jellyfin']}</FactRow>
              <FactRow label="Folders">Nothing to type: read from Sonarr, Radarr and rTorrent for you to confirm</FactRow>
            </dl>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-ui text-sm font-semibold text-foreground">Optional, after the required steps:</h3>
            <div className="grid grid-cols-3 gap-4">
              <OptionRow
                control={<Checkbox checked={wanted.trackers} onCheckedChange={(on) => setWanted((current) => ({ ...current, trackers: on }))} />}
                title="Trackers"
                description="Add each private tracker and its hit and run rule, so deleting a version never breaks one."
                bordered
              />
              <OptionRow
                control={<Checkbox checked={wanted.metadata} onCheckedChange={(on) => setWanted((current) => ({ ...current, metadata: on }))} />}
                title="Posters and ratings"
                description="Posters, title details and ratings from TMDB, MDBList and Trakt."
                bordered
              />
              <OptionRow
                control={<Checkbox checked={wanted.backup} onCheckedChange={(on) => setWanted((current) => ({ ...current, backup: on }))} />}
                title="Backup"
                description="Copy the database every few minutes to a folder or an S3-compatible bucket."
                bordered
              />
            </div>
          </div>
          <BarBottomAction
            summary="Unticked parts are skipped. Settings has them later."
            action={(
              <Button size="large" icon={<ArrowRight />} loading={choosing} onClick={() => void saveChoices(wanted).then(async (ok) => { if (ok) await advance('what'); })}>
                {first === 'done' ? 'Continue' : `Start with ${nameOf(first)}`}
              </Button>
            )}
          />
          {problem !== undefined && <Callout title={problem} />}
        </section>
      );
    }
    if (step === 'backup') {
      return (
        <BackupEditor
          // Keyed by the destination only, so the re-read after a key is created keeps the restore key on screen.
          key={JSON.stringify(status.backup.destination)}
          backup={status.backup}
          request={setupRequest}
          wizard={{ title: 'Back up the database', step: 'Optional', onSkip: () => void skip('backup'), onContinue: () => void advance('backup') }}
          onSaved={() => void refresh().then((fresh) => {
            if (fresh !== undefined && fresh.backup.key !== 'missing' && fresh.backup.key !== 'invalid') setStep(nextStep('backup', fresh, wanted));
          })}
          onKeyCreated={() => void refresh()}
        />
      );
    }
    if (step === 'trackers') {
      const row = trackers.find((tracker) => tracker.host === trackerView);
      if (trackerView === 'add' || trackers.length === 0) {
        return (
          <AddTracker
            address={newAddress}
            onAddress={setNewAddress}
            request={setupTrackerRequest}
            withCredential
            cancelLabel={trackers.length === 0 ? 'Skip trackers' : 'Cancel'}
            onCancel={() => (trackers.length === 0 ? void skip('trackers') : setTrackerView('list'))}
            onAdded={async (host, softwareSaved) => {
              setNewAddress('');
              await rereadTrackers();
              // Back to the list, where "Add another tracker" sits under the one just added.
              setTrackerView('list');
              void refresh();
              if (!softwareSaved) toasts.add({ title: `${trackerInfo(host).name} added as Other`, description: 'Its site software could not be saved. Remove it in Settings and add it again to pick the software.' });
            }}
          />
        );
      }
      if (row !== undefined) {
        const dropDraft = () => setRuleDrafts((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== row.host)));
        return (
          <div className="flex flex-col gap-3">
            <div><Button variant="ghost" icon={<ArrowLeft />} onClick={() => setTrackerView('list')}>All trackers</Button></div>
            <TrackerEditor
              key={row.host}
              row={row}
              draft={ruleDrafts[row.host] ?? draftFromRow(row)}
              checkedAt={checkedAt[row.host]}
              now={Date.now()}
              request={trackerRequest}
              onDraft={(draft) => (draft === undefined ? dropDraft() : setRuleDrafts((current) => ({ ...current, [row.host]: draft })))}
              onRow={(host, change, at) => {
                setTrackers((current) => current.map((tracker) => (tracker.host === host ? { ...tracker, ...change } : tracker)));
                setCheckedAt((current) => ({ ...current, [host]: at }));
              }}
              onRuleSaved={async () => {
                if (await rereadTrackers() !== undefined) dropDraft();
                setTrackerView('list');
              }}
              onRemoved={async () => {
                dropDraft();
                await rereadTrackers();
                setTrackerView('list');
                void refresh();
              }}
            />
          </div>
        );
      }
      const next = nextStep('trackers', status, wanted);
      return (
        <section aria-labelledby="trackers-title" className="flex flex-col gap-6 rounded-lg border border-border p-6 transition-opacity duration-(--duration-base) ease-out starting:opacity-0">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground [&>svg]:size-4"><ShieldCheck /></span>
            <h2 id="trackers-title" className="font-ui text-base font-bold text-foreground">Trackers</h2>
            {pill('connected', `${trackers.length} added`)}
            <span className="ml-auto font-data text-[13px] text-muted-foreground">Optional</span>
          </div>
          <div className="flex flex-col">
            {trackers.map((tracker) => (
              <TrackerListRow
                key={tracker.host}
                host={tracker.host}
                title={trackerInfo(tracker.host).name}
                subline={tracker.host}
                pill={<TrackerPill row={tracker} edited={ruleDrafts[tracker.host] !== undefined && isEdited(ruleDrafts[tracker.host], tracker)} />}
                selected={false}
                onClick={() => setTrackerView(tracker.host)}
              />
            ))}
          </div>
          {noRule.length > 0 && (
            <p className="font-ui text-[13px] text-muted-foreground">
              {list(noRule)} {noRule.length === 1 ? 'has' : 'have'} no hit and run rule yet, so {noRule.length === 1 ? 'its' : 'their'} torrents keep seeding until you save one. Open a tracker to set its rule.
            </p>
          )}
          <div><Button variant="outline" icon={<Plus />} onClick={() => setTrackerView('add')}>Add another tracker</Button></div>
          <BarBottomAction
            summary="Rules can wait: set them here or later in Settings."
            secondary={<Button variant="outline" icon={<ArrowLeft />} onClick={back}>Back</Button>}
            action={<Button size="large" icon={<ArrowRight />} onClick={() => void advance('trackers')}>{next === 'done' ? 'Finish setup' : `Continue to ${nameOf(next)}`}</Button>}
          />
        </section>
      );
    }
    if (step === 'metadata') {
      const typed = metadataServices.filter((info) => (draftOf(info.name).secrets[info.credentials[0].key] ?? '').trim() !== '');
      const anyTesting = metadataServices.some((info) => checks[info.name].kind === 'testing');
      // A Check still running would make Save and continue connect the same service a second time alongside it.
      const anyBusy = anyTesting || metadataServices.some((info) => connections.pending[info.name] !== undefined);
      // Each Check already saves a passing key, so this connects only what is typed and still unsaved.
      const saveMetadata = async () => {
        setSavingMetadata(true);
        try {
          let all = true;
          for (const info of typed) if (!await connections.connect(info.name)) all = false;
          if (all) await advance('metadata');
        } finally {
          setSavingMetadata(false);
        }
      };
      return (
        <section aria-labelledby="metadata-title" className="flex flex-col gap-6 rounded-lg border border-border p-6 transition-opacity duration-(--duration-base) ease-out starting:opacity-0">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground [&>svg]:size-4"><Star /></span>
            <h2 id="metadata-title" className="font-ui text-base font-bold text-foreground">Posters and ratings</h2>
            {metadataPill}
            <span className="ml-auto font-data text-[13px] text-muted-foreground">Optional</span>
          </div>
          {metadataServices.map((info) => {
            const [credential] = info.credentials;
            const check = checks[info.name];
            const draft = draftOf(info.name);
            const value = draft.secrets[credential.key] ?? '';
            const state = pillFor(info, check, editedOf(info.name));
            return (
              <div key={info.name} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  {info.logo === null ? <Globe aria-hidden="true" className="size-6 shrink-0" /> : <Logo name={info.logo} alt="" className="size-6" />}
                  <span className="font-ui text-sm font-semibold text-foreground">{info.label}</span>
                  <span className="font-ui text-[13px] text-muted-foreground">{info.usedFor}</span>
                  {pill(state.state, state.text)}
                </div>
                {isConfigured(saved?.[info.name]) ? (
                  <FieldLabelled label={credential.label} help={`Saved. ${credential.help}`}>
                    <InputSearch key="locked" variant="field" readOnly value="" icon={<Lock aria-hidden="true" />} placeholder="••••••••••••••••••••" wrapperClassName="bg-muted" />
                  </FieldLabelled>
                ) : (
                  <FieldLabelled
                    label={credential.label}
                    error={check.kind === 'rejected' ? `${info.label} refused this ${info.refused}.`
                      : check.kind === 'unreachable' ? `Check that the seedbox can reach ${info.label} over the internet.` : undefined}
                    help={credential.help}
                    action={(
                      <Button
                        variant="outline"
                        loading={connections.pending[info.name] === 'connect'}
                        disabled={value.trim() === '' || anyTesting || savingMetadata}
                        onClick={() => void connections.connect(info.name)}
                      >
                        Check
                      </Button>
                    )}
                  >
                    <InputSearch
                      key="open"
                      variant="field"
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={credential.placeholder}
                      value={value}
                      readOnly={check.kind === 'testing' || connections.pending[info.name] === 'connect'}
                      aria-invalid={check.kind === 'rejected' || check.kind === 'unreachable' || undefined}
                      onValueChange={(next) => connections.setDraft(info.name, { ...draft, secrets: { ...draft.secrets, [credential.key]: next } })}
                    />
                  </FieldLabelled>
                )}
                {connections.problems[info.name] !== undefined && <Callout title={connections.problems[info.name]} />}
              </div>
            );
          })}
          <BarBottomAction
            summary="Check tests each key. Leave any blank to add it later in Settings."
            secondary={<Button variant="outline" disabled={savingMetadata || choosing} onClick={() => void skip('metadata')}>Skip posters and ratings</Button>}
            action={(
              <Button size="large" loading={savingMetadata} disabled={(typed.length === 0 && connected.length === 0) || anyBusy} onClick={() => void saveMetadata()}>
                Save and continue
              </Button>
            )}
          />
        </section>
      );
    }
    if (step === 'done') {
      return (
        <section aria-labelledby="done-title" className="flex flex-col gap-6 rounded-lg border border-border p-6 transition-opacity duration-(--duration-base) ease-out starting:opacity-0">
          <div className="flex items-center gap-3">
            <CircleCheck aria-hidden="true" className="size-7 shrink-0" />
            <h2 id="done-title" className="font-ui text-base font-bold text-foreground">Setup is done</h2>
          </div>
          <p className="max-w-170 font-ui text-sm text-foreground">
            media-manager-2 now watches every download in rTorrent and retries missed searches, stalled torrents and blocked imports on its own.
          </p>
          <form
            role="search"
            className="flex flex-col gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              if (query.trim() === '') return;
              onFinished();
              navigate(`/search?q=${encodeURIComponent(query.trim())}`);
            }}
          >
            <InputSearch variant="search" type="search" aria-label="Find something to watch" placeholder="Find something to watch" value={query} onValueChange={setQuery} />
            <p className="font-ui text-xs text-subtle-foreground">Search Sonarr and Radarr for a show or movie to add.</p>
          </form>
          <dl className="flex flex-col">
            <FactRow label="Hit and run rules">
              {trackers.length === 0 ? 'No trackers added. Settings has them when you want them'
                : noRule.length > 0 ? `${list(noRule)} ${noRule.length === 1 ? 'has none yet, so its' : 'have none yet, so their'} torrents keep seeding`
                  : 'Every tracker has one'}
            </FactRow>
            <FactRow label="Posters and ratings">
              {connected.length === 0 ? 'None yet. Settings has them when you want them'
                : connected.length === metadataServices.length ? `${list(connected.map((info) => info.label))} connected`
                  : `${list(connected.map((info) => info.label))} connected. ${list(metadataServices.filter((info) => !connected.includes(info)).map((info) => info.label))} can wait for Settings`}
            </FactRow>
            <FactRow label="Backup">{backupSkipped || status.backup.destination === null ? 'Skipped. Settings has it when you want it' : backupState.text}</FactRow>
          </dl>
          <BarBottomAction
            summary="Everything here can change later in Settings."
            action={<Button variant="outline" size="large" icon={<Library />} onClick={() => { onFinished(); navigate('/'); }}>Open the app</Button>}
          />
        </section>
      );
    }
    // Folders renders outside this function so it can stay mounted.
    if (step === 'folders' || saved === undefined) return null;
    if (jellyfin !== undefined && step === 'mediaServer') {
      return (
        <JellyfinEditor
          key={step}
          status={jellyfin}
          connected={status.required.mediaServer === 'done'}
          version={checks.jellyfin.kind === 'ok' ? checks.jellyfin.version : undefined}
          request={setupRequest}
          wizard={{ step: requiredStep('mediaServer'), onBack: back }}
          onSaved={() => void advance('mediaServer')}
        />
      );
    }
    const service = serviceOf(step);
    const info = infoOf(service);
    const signIn = connections.usingSignIn(status.plexSignInTokenAvailable);
    return (
      <Editor
        key={step}
        info={info}
        saved={saved[service]}
        draft={draftOf(service)}
        check={checks[service]}
        pending={connections.pending[service]}
        problem={connections.problems[service]}
        replacing={connections.replacing}
        now={Date.now()}
        onDraft={(draft) => connections.setDraft(service, draft)}
        onReplacing={(key, value) => connections.setReplacingKey(service, key, value)}
        signInToken={service === 'plex' && status.plexSignInTokenAvailable ? { on: signIn, onChange: connections.choosePlexSignIn } : undefined}
        onConnect={() => void connectStep(step)}
        onCheck={() => void connections.checkSaved(service)}
        onDiscard={() => connections.discard(service)}
        wizard={{
          title: `Connect ${info.label}`,
          step: requiredStep(step),
          next: nameOf(nextStep(step, status, wanted)),
          onBack: back,
          // Each prefill hint stays only while its field still holds the suggested value.
          hints: step === 'rtorrent' && rtorrentSuggestion !== undefined ? {
            ...(rtorrentSuggestion.address !== null && draftOf('rtorrent').address === rtorrentSuggestion.address
              ? { address: { label: 'XML-RPC address', help: 'Read from Sonarr\'s download client.' } } : {}),
            credentials: {
              ...(rtorrentSuggestion.username !== null && draftOf('rtorrent').secrets['rtorrent.username'] === rtorrentSuggestion.username
                ? { 'rtorrent.username': { help: 'Read from Sonarr\'s download client.' } } : {}),
              'rtorrent.password': { placeholder: 'Type the password', help: 'Sonarr hides the password, so type it here.' },
            },
          } : undefined,
        }}
      />
    );
  };

  return (
    <div className={`min-h-screen ${touchInputs}`}>
      <AppBarDesktop
        className="sticky top-0 z-10"
        productName={<h1 ref={headingRef} tabIndex={-1}>media-manager-2</h1>}
        actions={(
          <>
            {signOutProblem}
            <Button variant="ghost" onClick={onSignOut} disabled={signOutDisabled}>{signOutLabel}</Button>
          </>
        )}
      />
      <main className="flex flex-col gap-6 px-(--page-margin) pt-2 pb-10">
        <HeaderPage title="Set up media-manager-2" summary={wizardSummary(status, wanted, step === 'done')} />
        {load.kind === 'failed' ? (
          <Callout title="Setup could not be read" action={<Button variant="outline" icon={<RefreshCw />} onClick={() => void read()}>Retry</Button>}>
            Check that media-manager-2 is running, then retry.
          </Callout>
        ) : (
          <>
            <PiecesStrip
              checks={checks}
              editedOf={editedOf}
              folders={folders}
              look={step === 'done' ? 'done' : 'setup'}
              watch={jellyfin === undefined ? undefined : { logo: 'jellyfin', name: 'Jellyfin', ...jellyfinPill }}
            />
            <div className="flex items-start gap-8">
              <nav aria-label="Setup steps" className="flex w-80 shrink-0 flex-col">
                <TrackerListRow
                  host=""
                  icon={<ListChecks />}
                  title="What to set up"
                  subline={chosen ? 'Optional parts chosen' : 'Pick the optional parts'}
                  pill={chosen ? pill('connected', 'Done') : pill('not-set-up', 'In progress')}
                  selected={step === 'what'}
                  onClick={() => setStep('what')}
                />
                <LabelGroup count={`${doneCount} of 5`}>Required</LabelGroup>
                {serviceSteps.map(({ name, about }) => serviceRow(name, about, name))}
                {jellyfin === undefined ? serviceRow('plex', 'Media server', 'mediaServer') : (
                  <RowService
                    logo="jellyfin"
                    name="Jellyfin"
                    address="Media server"
                    state={jellyfinPill.state}
                    stateText={jellyfinPill.text}
                    selected={step === 'mediaServer'}
                    onClick={() => setStep('mediaServer')}
                  />
                )}
                <TrackerListRow
                  host=""
                  icon={<Folder />}
                  title="Folders"
                  subline={status.required.folders === 'done' ? '6 folders' : 'Where files go'}
                  pill={pill(folders.state, folders.text)}
                  selected={step === 'folders'}
                  onClick={() => setStep('folders')}
                />
                <LabelGroup count="can wait">Optional</LabelGroup>
                <TrackerListRow
                  host=""
                  icon={<ShieldCheck />}
                  title="Trackers"
                  subline={trackers.length > 0 ? list(trackers.map((row) => trackerInfo(row.host).name)) : 'Hit and run rules'}
                  pill={trackers.length > 0 ? pill('connected', `${trackers.length} added`)
                    : status.optional.trackers.status === 'skipped' ? pill('not-set-up', 'Skipped') : pill('not-set-up', 'Not set up')}
                  selected={step === 'trackers'}
                  onClick={() => { setTrackerView('list'); setStep('trackers'); }}
                />
                <TrackerListRow
                  host=""
                  icon={<Star />}
                  title="Posters and ratings"
                  subline={connected.length > 0 ? list(connected.map((info) => info.label)) : 'TMDB, MDBList and Trakt'}
                  pill={metadataPill}
                  selected={step === 'metadata'}
                  onClick={() => setStep('metadata')}
                />
                <TrackerListRow
                  host=""
                  icon={<DatabaseBackup />}
                  title="Backup"
                  subline={backupSkipped ? 'Later, in Settings' : backupWords(status.backup.destination) ?? 'Database copies'}
                  pill={backupSkipped ? pill('not-set-up', 'Skipped') : pill(backupState.state, backupState.text)}
                  selected={step === 'backup'}
                  onClick={() => setStep('backup')}
                />
              </nav>
              <div ref={paneRef} className="flex min-w-0 flex-1 scroll-mt-20 flex-col gap-4">
                {load.kind === 'loading' ? <div><SkeletonRowTwoLine /><SkeletonRowTwoLine /></div> : (
                  <>
                    {/* Stays mounted once the services it reads from are saved, so coming back keeps the folders and any edits without reading them again. */}
                    {foldersReady && (
                      <div hidden={step !== 'folders'}>
                        <FoldersEditor
                          request={setupRequest}
                          wizard={{ title: 'Confirm folders', step: requiredStep('folders'), onBack: back, onContinue: () => void advance('folders') }}
                          // A warning stays on screen; Continue then moves on.
                          onSaved={(_, warnings) => (Object.keys(warnings).length === 0 ? void advance('folders') : void refresh())}
                        />
                      </div>
                    )}
                    {step !== 'folders' && pane()}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
