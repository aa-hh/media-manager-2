import { ArrowLeft, ArrowRight, CircleCheck, DatabaseBackup, Folder, Library, ListChecks, Plus, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { type ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppBarDesktop } from '@/components/ui/app-bar';
import { BarBottomAction } from '@/components/ui/bar-bottom-action';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Checkbox } from '@/components/ui/checkbox';
import { FactRow } from '@/components/ui/fact';
import { HeaderPage } from '@/components/ui/header-page';
import { LabelGroup } from '@/components/ui/label-group';
import { OptionRow } from '@/components/ui/option-row';
import { RowService } from '@/components/ui/row-service';
import { SkeletonRowTwoLine } from '@/components/ui/skeleton';
import { type ServiceState, StatusServicePill } from '@/components/ui/status-service-pill';
import { useToastManager } from '@/components/ui/toast';
import { navigate } from '../navigation';
import { BackupEditor } from './BackupEditor';
import { FoldersEditor } from './FoldersEditor';
import { isConfigured, list, pillFor, savedAddress, stripSummary } from './model';
import { Editor, PiecesStrip } from './Settings';
import {
  backupPill, backupWords, firstStep, nextStep, type OptionalPart, previousStep, type RequiredPart, requiredParts, type SetupStatus, wantedParts, type WizardStep, wizardSummary,
} from './setup';
import { AddTracker, TrackerEditor, TrackerListRow, TrackerPill } from './TrackerEditor';
import { draftFromRow, isEdited, type RuleDraft, trackerInfo, type TrackerRow } from './trackers';
import { infoOf, requester, useServices } from './useServices';

// The pill's own logo and name are off here: its first two children are hidden, the dot stays.
const pillOnly = '[&>span:nth-child(-n+2)]:hidden';
const pill = (state: ServiceState, text: string) => <StatusServicePill logo={null} name={null} state={state} className={pillOnly}>{text}</StatusServicePill>;
type ServiceStep = Exclude<RequiredPart, 'folders'>;
const serviceSteps: { name: ServiceStep; about: string; needs: string }[] = [
  { name: 'sonarr', about: 'TV shows', needs: 'Address and API key, from Sonarr\'s Settings > General' },
  { name: 'radarr', about: 'Movies', needs: 'Address and API key, from Radarr\'s Settings > General' },
  { name: 'rtorrent', about: 'Downloads', needs: 'Address, username and password' },
  { name: 'plex', about: 'Media server', needs: 'Address. The token comes from your Plex sign-in' },
];
const stepNames: Record<WizardStep, string> = {
  what: 'What to set up', sonarr: 'Sonarr', radarr: 'Radarr', rtorrent: 'rTorrent', plex: 'Plex', folders: 'Folders', trackers: 'trackers', backup: 'backup', done: 'the end of setup',
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
    // Skipping one part keeps the other's skip; Start clears both.
    const part = (name: OptionalPart) => ({ wanted: choice[name], skipped: name === skip || (skip !== undefined && status.optional[name].status === 'skipped') });
    try {
      const response = await setupRequest('PUT', '/choices', { trackers: part('trackers'), backup: part('backup') });
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

  const finish = (search: boolean) => {
    onFinished();
    navigate('/');
    if (search) window.requestAnimationFrame(() => document.querySelector<HTMLInputElement>('input[type="search"]')?.focus());
  };

  const chosen = Object.values(status.optional).some((part) => part.wanted || part.status === 'skipped');
  const doneCount = requiredParts.filter((part) => status.required[part] === 'done').length;
  const optionalWanted = (['trackers', 'backup'] as const).filter((part) => wanted[part]);
  const optionalStep = (part: OptionalPart) => (wanted[part] ? `Optional · ${optionalWanted.indexOf(part) + 1} of ${optionalWanted.length}` : 'Optional');
  const requiredStep = (part: RequiredPart) => `Step ${requiredParts.indexOf(part) + 1} of 5 required`;
  const back = () => setStep(previousStep(step));
  const noRule = trackers.filter((row) => row.status === 'no_rule').map((row) => trackerInfo(row.host).name);
  const folders = status.required.folders === 'done' ? { state: 'connected' as const, text: 'Confirmed' } : { state: 'not-set-up' as const, text: 'Not set' };
  const backupSkipped = status.optional.backup.status === 'skipped';
  const backupState = backupPill(status.backup);
  const foldersReady = step === 'folders' || (['sonarr', 'radarr', 'rtorrent'] as const).every((part) => status.required[part] === 'done');

  const connectStep = async (name: ServiceStep) => {
    const signIn = name === 'plex' && connections.usingSignIn(status.plexSignInTokenAvailable);
    if (isConfigured(saved?.[name]) && editedOf(name) === 0 && !signIn) return advance(name);
    if (await (signIn ? connections.connectPlexWithSignIn() : connections.connect(name))) await advance(name);
  };

  const pane = () => {
    if (step === 'what') {
      const first = nextStep('what', status, wanted);
      return (
        <section aria-labelledby="what-title" className="flex flex-col gap-6 rounded-lg border border-border p-6 transition-opacity duration-(--duration-base) ease-out starting:opacity-0">
          <div className="flex items-center gap-3">
            <ListChecks aria-hidden="true" className="size-6 shrink-0" />
            <h2 id="what-title" className="font-ui text-base font-bold text-foreground">What to set up</h2>
            <span className="ml-auto font-data text-[13px] text-muted-foreground">About 10 minutes</span>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-ui text-sm font-semibold text-foreground">Required before the library opens. Have these ready:</h3>
            <dl className="flex flex-col">
              {serviceSteps.map((service) => <FactRow key={service.name} label={infoOf(service.name).label}>{service.needs}</FactRow>)}
              <FactRow label="Folders">Nothing to type: read from Sonarr, Radarr and rTorrent for you to confirm</FactRow>
            </dl>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-ui text-sm font-semibold text-foreground">Optional. Untick to skip, or add later in Settings:</h3>
            <div className="grid grid-cols-2 gap-4">
              <OptionRow
                control={<Checkbox checked={wanted.trackers} onCheckedChange={(on) => setWanted((current) => ({ ...current, trackers: on }))} />}
                title="Trackers"
                description="Add each private tracker and its hit and run rule, so deleting a version never breaks one."
              />
              <OptionRow
                control={<Checkbox checked={wanted.backup} onCheckedChange={(on) => setWanted((current) => ({ ...current, backup: on }))} />}
                title="Backup"
                description="Copy the database every few minutes to a folder or an S3-compatible bucket."
              />
            </div>
          </div>
          <BarBottomAction
            summary="Anything unticked is skipped. Settings has every part later."
            action={(
              <Button size="large" icon={<ArrowRight />} loading={choosing} onClick={() => void saveChoices(wanted).then(async (ok) => { if (ok) await advance('what'); })}>
                {first === 'done' ? 'Continue' : `Start with ${stepNames[first]}`}
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
          wizard={{ title: 'Back up the database', step: optionalStep('backup'), onSkip: () => void skip('backup'), onContinue: () => void advance('backup') }}
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
              setTrackerView(host);
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
            <span className="ml-auto font-data text-[13px] text-muted-foreground">{optionalStep('trackers')}</span>
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
            action={<Button size="large" icon={<ArrowRight />} onClick={() => void advance('trackers')}>{next === 'backup' ? 'Continue to backup' : 'Finish setup'}</Button>}
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
          <dl className="flex flex-col">
            <FactRow label="Hit and run rules">
              {trackers.length === 0 ? 'No trackers added. Settings has them when you want them'
                : noRule.length > 0 ? `${list(noRule)} ${noRule.length === 1 ? 'has none yet, so its' : 'have none yet, so their'} torrents keep seeding`
                  : 'Every tracker has one'}
            </FactRow>
            <FactRow label="Backup">{backupSkipped || status.backup.destination === null ? 'Skipped. Settings has it when you want it' : backupState.text}</FactRow>
          </dl>
          <BarBottomAction
            summary="Everything here can change later in Settings."
            secondary={<Button variant="outline" size="large" icon={<Search />} onClick={() => finish(true)}>Search for something</Button>}
            action={<Button size="large" icon={<Library />} onClick={() => finish(false)}>Open the library</Button>}
          />
        </section>
      );
    }
    // Folders renders outside this function so it can stay mounted.
    if (step === 'folders' || saved === undefined) return null;
    const info = infoOf(step);
    const signIn = connections.usingSignIn(status.plexSignInTokenAvailable);
    return (
      <Editor
        key={step}
        info={info}
        saved={saved[step]}
        draft={draftOf(step)}
        check={checks[step]}
        pending={connections.pending[step]}
        problem={connections.problems[step]}
        replacing={connections.replacing}
        now={Date.now()}
        onDraft={(draft) => connections.setDraft(step, draft)}
        onReplacing={(key, value) => connections.setReplacingKey(step, key, value)}
        signInToken={step === 'plex' && status.plexSignInTokenAvailable ? { on: signIn, onChange: connections.choosePlexSignIn } : undefined}
        onConnect={() => void connectStep(step)}
        onCheck={() => void connections.checkSaved(step)}
        onDiscard={() => connections.discard(step)}
        wizard={{ title: `Connect ${info.label}`, step: requiredStep(step), next: stepNames[nextStep(step, status, wanted)], onBack: back }}
      />
    );
  };

  return (
    <div className="min-h-screen">
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
              summary={step === 'done' ? 'Every link answers. Search for something, pick a release, and watch it download live.' : stripSummary(checks)}
              trackers={trackers}
              noTrackers="Optional, no tracker yet"
              checks={checks}
              editedOf={editedOf}
              folders={folders}
              look={step === 'done' ? 'done' : 'setup'}
            />
            <div className="flex items-start gap-8">
              <nav aria-label="Setup steps" className="flex w-80 shrink-0 flex-col">
                <TrackerListRow
                  host=""
                  icon={<ListChecks />}
                  title="What to set up"
                  subline={chosen ? 'Trackers and backup chosen' : 'Pick the optional parts'}
                  pill={chosen ? pill('connected', 'Done') : pill('not-set-up', 'In progress')}
                  selected={step === 'what'}
                  onClick={() => setStep('what')}
                />
                <LabelGroup count={`${doneCount} of 5`}>Required</LabelGroup>
                {serviceSteps.map(({ name, about }) => {
                  const member = infoOf(name);
                  const state = pillFor(member, checks[name], editedOf(name));
                  const address = savedAddress(saved?.[name]);
                  return (
                    <RowService
                      key={name}
                      logo={member.logo!}
                      name={member.label}
                      address={address === '' ? about : address}
                      state={state.state}
                      stateText={state.text}
                      selected={step === name}
                      onClick={() => setStep(name)}
                    />
                  );
                })}
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
