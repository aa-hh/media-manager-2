import { FileText, Globe, Lock, Plug, Plus, RefreshCw, Save, Trash2, Undo2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { BarBottomAction } from '@/components/ui/bar-bottom-action';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { CalloutInfo } from '@/components/ui/callout-info';
import { CollapsibleContent } from '@/components/ui/collapsible-content';
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible-trigger';
import { Dialog } from '@/components/ui/dialog';
import { Fact, FactRow } from '@/components/ui/fact';
import { FieldLabelled } from '@/components/ui/field-labelled';
import { FieldLabelledOptional } from '@/components/ui/field-labelled-optional';
import { FieldNumber } from '@/components/ui/field-number';
import { InputSearch } from '@/components/ui/input-search';
import { Logo } from '@/components/ui/logo';
import { OptionRow } from '@/components/ui/option-row';
import { Radio, RadioGroup } from '@/components/ui/radio';
import { StatusRulePill } from '@/components/ui/status-rule-pill';
import { StatusServicePill } from '@/components/ui/status-service-pill';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import {
  addBand, aTorrentOf, type Band, type Connection, connectionFailed, connectionFailure, credentialName, credentialSource, draftFromRow, everyTorrentOf,
  hasAnyRule, isEdited, moreSummary, notANumber, problemField, type RuleDraft, ruleBody, rulePill, type Software, softwareChoices, softwareLabels,
  statFacts, trackerInfo, type TrackerRow,
} from './trackers';

/** Sends one request under the API path the caller picks (/api/settings/trackers or /api/setup). Throws when media-manager-2 did not answer or the session ended. */
export type TrackerRequest = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) => Promise<Response>;

const noAnswer = 'media-manager-2 did not answer. Try again.';
// The service pill's own logo and name are off here: its first two children are hidden, the dot stays.
const pillOnly = '[&>span:nth-child(-n+2)]:hidden';
const timeOf = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const ago = (at: number, now: number) => {
  const minutes = Math.floor((now - at) / 60_000);
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ago`;
};
const path = (host: string, rest = '') => `/${encodeURIComponent(host)}${rest}`;

/** The tracker's logo, or a globe on a grey disc for a tracker with none. */
function TrackerMark({ host, size }: { host: string; size: 'row' | 'header' }) {
  const { logo } = trackerInfo(host);
  if (logo !== undefined) return <Logo name={logo} alt="" className={size === 'header' ? 'size-8' : 'size-6'} />;
  return (
    <span aria-hidden="true" className={cn('flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground', size === 'header' ? 'size-8 [&>svg]:size-4' : 'size-6 [&>svg]:size-3.5')}>
      <Globe />
    </span>
  );
}

/** The pill a tracker shows in its row: a failed account connection, unsaved edits, or its rule state. */
export function TrackerPill({ row, edited }: { row: TrackerRow; edited: boolean }) {
  if (connectionFailed(row) || edited) {
    const state = connectionFailed(row) ? 'failed' : 'unsaved';
    return (
      <StatusServicePill logo={null} name={null} state={state} className={pillOnly}>
        {state === 'failed' ? connectionFailure(row) : 'Unsaved edits'}
      </StatusServicePill>
    );
  }
  const pill = rulePill(row);
  return <StatusRulePill tone={pill.warning ? 'warning' : 'default'}>{pill.text}</StatusRulePill>;
}

type TrackerListRowProps = { host: string; title: ReactNode; subline: ReactNode; pill?: ReactNode; selected: boolean; adding?: boolean; icon?: ReactNode; onClick: () => void };

/** A tracker, or Folders and Backup with an icon in place of the tracker mark, in the settings list, 56 px, laid out as RowService. */
export function TrackerListRow({ host, title, subline, pill, selected, adding = false, icon, onClick }: TrackerListRowProps) {
  return (
    <button
      type="button"
      aria-current={selected || undefined}
      onClick={onClick}
      className={cn(
        'relative flex h-14 w-full items-center gap-3 rounded-sm px-4 text-left',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0 focus-ring',
        selected ? 'bg-selected' : 'hover:bg-surface-hover active:bg-surface-pressed',
      )}
    >
      {/* Always present and out of the flow, so selecting a row moves nothing; only its opacity changes. */}
      <span aria-hidden="true" className={cn('absolute top-2 bottom-2 left-0 w-0.75 rounded-[2px] bg-foreground transition-opacity duration-(--duration-fast) ease-out', !selected && 'opacity-0')} />
      {adding
        ? <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-4"><Plus /></span>
        : icon !== undefined
          ? <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-4">{icon}</span>
          : <TrackerMark host={host} size="row" />}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-ui text-sm font-semibold text-foreground">{title}</span>
        <span className="truncate font-data text-[13px] font-normal text-muted-foreground">{subline}</span>
      </span>
      {pill}
    </button>
  );
}

type AddTrackerProps = {
  address: string;
  onAddress: (address: string) => void;
  request: TrackerRequest;
  onCancel: () => void;
  /** The Cancel button's words; the setup wizard says "Skip trackers". */
  cancelLabel?: string;
  /** Called with the hostname the server stored, and whether its site software was saved too. */
  onAdded: (host: string, softwareSaved: boolean) => void;
  /** Asks for the account's credential and adds through /api/setup/trackers, which tests it first (the setup wizard). */
  withCredential?: boolean;
};

/** The pane for adding a tracker: its web address and site software, and in the setup wizard its credential. */
export function AddTracker({ address, onAddress, request, onCancel, cancelLabel = 'Cancel', onAdded, withCredential = false }: AddTrackerProps) {
  const [software, setSoftware] = useState<Software>('unit3d');
  const [credential, setCredential] = useState('');
  const [pending, setPending] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  const [credentialError, setCredentialError] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const askCredential = withCredential && software !== 'other';
  const ready = address.trim() !== '' && (!askCredential || credential.trim() !== '');

  const add = async () => {
    setPending(true);
    setFieldError(undefined);
    setCredentialError(undefined);
    setProblem(undefined);
    try {
      const response = await request('POST', '', withCredential ? { host: address, software, ...(askCredential && { credential: credential.trim() }) } : { host: address });
      if (response.status === 400) return setFieldError('Enter the address you open the tracker at, such as blutopia.cc.');
      if (response.status === 409) return setFieldError('This tracker is already added.');
      if (withCredential && response.status === 200) {
        const { connection } = await response.json() as { connection: Connection };
        if (connection.kind === 'rejected') return setCredentialError(`${trackerInfo(address.trim()).name} refused this ${credentialName(software)}.`);
        if (connection.kind === 'unreachable') return setFieldError('The tracker did not answer within 10 seconds. Check the address.');
        return setProblem('The account could not be checked. Try again, or pick Other to add it without one.');
      }
      if (response.status !== 201) return setProblem('The tracker could not be added. Try again.');
      const { host } = await response.json() as { host: string };
      if (withCredential) return onAdded(host, true);
      let softwareSaved = true;
      if (software !== 'other') {
        try {
          softwareSaved = (await request('PUT', path(host, '/software'), { software })).status === 204;
        } catch {
          softwareSaved = false;
        }
      }
      onAdded(host, softwareSaved);
    } catch {
      setProblem(noAnswer);
    } finally {
      setPending(false);
    }
  };

  return (
    <section aria-labelledby="add-tracker-title" className="flex flex-col gap-6 rounded-lg border border-border p-6 transition-opacity duration-(--duration-base) ease-out starting:opacity-0">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground [&>svg]:size-4"><Plus /></span>
        <h2 id="add-tracker-title" className="font-ui text-base font-bold text-foreground">Add a tracker</h2>
      </div>
      <FieldLabelled
        label="Web address"
        error={fieldError}
        help="The address you open the tracker at. Torrents whose tracker address is on this site, or whose Sonarr or Radarr indexer has the same name, follow its rule."
      >
        <InputSearch
          variant="field"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          placeholder="e.g. blutopia.cc"
          className="font-data"
          value={address}
          readOnly={pending}
          aria-invalid={fieldError !== undefined || undefined}
          onValueChange={(value) => onAddress(value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && ready) void add(); }}
        />
      </FieldLabelled>
      <div className="flex flex-col gap-1.5">
        <span id="site-software-label" className="font-ui text-[13px] font-semibold text-foreground">Site software</span>
        <RadioGroup aria-labelledby="site-software-label" value={software} onValueChange={(value) => setSoftware(value as Software)} className="grid grid-cols-2 gap-2">
          {softwareChoices.map((choice) => (
            <OptionRow
              key={choice.software}
              control={<Radio value={choice.software} />}
              title={softwareLabels[choice.software]}
              description={choice.description}
              bordered
            />
          ))}
        </RadioGroup>
        <p className="font-ui text-xs text-subtle-foreground">Picks how media-manager-2 reads your account. Other: no account connection; only the hit and run rule is used.</p>
      </div>
      {askCredential && (
        <FieldLabelled label={credentialName(software)} error={credentialError} help={credentialSource(software)}>
          <InputSearch
            variant="field"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={`Paste the ${credentialName(software)}`}
            value={credential}
            readOnly={pending}
            aria-invalid={credentialError !== undefined || undefined}
            onValueChange={(value) => setCredential(value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && ready) void add(); }}
          />
        </FieldLabelled>
      )}
      <BarBottomAction
        summary={askCredential
          ? `Tests the ${credentialName(software)} with the site, then adds the tracker. Its torrents keep seeding until you give it a rule.`
          : 'Adds the tracker with no rule. Its torrents keep seeding until you save one.'}
        secondary={<Button variant="outline" disabled={pending} onClick={onCancel}>{cancelLabel}</Button>}
        action={<Button size="large" icon={<Plus />} loading={pending} disabled={!ready} onClick={() => void add()}>Add tracker</Button>}
      />
      {problem !== undefined && <Callout title={problem} />}
    </section>
  );
}

type RuleError = { field: string | null; reason: string };

type TrackerEditorProps = {
  row: TrackerRow;
  draft: RuleDraft;
  /** When the screen last read this tracker's connection. */
  checkedAt: number | undefined;
  now: number;
  request: TrackerRequest;
  onDraft: (draft: RuleDraft | undefined) => void;
  /** A connection check or credential save changed these fields of the row. */
  onRow: (host: string, change: Partial<TrackerRow>, checkedAt: number) => void;
  /** The rule changed on the server; the screen reads the trackers again and drops the draft. */
  onRuleSaved: () => Promise<void>;
  onRemoved: () => void;
};

/** The pane for one tracker: its account connection and its hit and run rule. */
export function TrackerEditor({ row, draft, checkedAt, now, request, onDraft, onRow, onRuleSaved, onRemoved }: TrackerEditorProps) {
  const { name, named } = trackerInfo(row.host);
  const [secret, setSecret] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [formCheck, setFormCheck] = useState<Connection>();
  const [testing, setTesting] = useState<'connect' | 'check'>();
  const [connectionProblem, setConnectionProblem] = useState<string>();
  const [ruleError, setRuleError] = useState<RuleError>();
  const [saving, setSaving] = useState<'save' | 'env'>();
  const [moreOpen, setMoreOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState<'confirm' | 'refused'>();
  const [removing, setRemoving] = useState(false);
  const [removeProblem, setRemoveProblem] = useState<string>();

  const credential = credentialName(row.software);
  const connection = formCheck ?? row.connection;
  const typed = secret.trim() !== '';
  const locked = row.credentialSet && !replacing;
  const original = draftFromRow(row);
  const edited = isEdited(draft, row);
  const gazelle = row.software === 'gazelle';
  const stats = connection.kind === 'ok' ? connection.stats : undefined;
  const errorAt = (field: string) => (ruleError?.field === field ? ruleError.reason : undefined);
  const knownFields = new Set([
    'seedHours', 'ratio', 'logic', 'minGlobalRatio', 'partial.exemptBelow', 'partial.ratio', 'partial.maxHours',
    'margins.timePercent', 'margins.extraHours', 'margins.ratioExtra', 'margins.globalPercent',
    ...draft.bands.flatMap((band, index) => (band.kind === 'locked' ? [] : [`seedHours[${index}]`, `seedHours[${index}].upToGB`, `seedHours[${index}].hours`, `seedHours[${index}].perGB`])),
  ]);

  const setDraft = (next: RuleDraft) => {
    setRuleError(undefined);
    onDraft(next);
  };
  const setBand = (index: number, band: Band) => setDraft({ ...draft, bands: draft.bands.map((current, at) => (at === index ? band : current)) });

  /** Tests the typed credential, or the saved one when nothing is typed; a working new one is then saved. */
  const test = async (kind: 'connect' | 'check') => {
    setTesting(kind);
    setConnectionProblem(undefined);
    try {
      const response = await request('POST', path(row.host, '/test'), kind === 'connect' ? { credential: secret.trim() } : {});
      if (!response.ok) throw new Error('The test did not run.');
      const result = await response.json() as Connection;
      if (kind === 'check') {
        setFormCheck(undefined);
        onRow(row.host, { connection: result }, Date.now());
        return;
      }
      // An older UNIT3D still takes the token; it only can't share stats, so the token is kept.
      if (result.kind !== 'ok' && result.kind !== 'too_old') {
        setFormCheck(result);
        return;
      }
      const saved = await request('PUT', path(row.host, '/credential'), { value: secret.trim() });
      if (saved.status !== 204) {
        setConnectionProblem(`${name} answered, but the new ${credential} could not be saved. Try again.`);
        return;
      }
      setSecret('');
      setReplacing(false);
      setFormCheck(undefined);
      onRow(row.host, { credentialSet: true, connection: result }, Date.now());
    } catch {
      setConnectionProblem(noAnswer);
    } finally {
      setTesting(undefined);
    }
  };

  const saveRule = async () => {
    const local = notANumber(draft);
    const fail = (problem: RuleError) => {
      setRuleError(problem);
      if (problem.field?.startsWith('partial.') || problem.field?.startsWith('margins.')) setMoreOpen(true);
    };
    if (local !== undefined) return fail(local);
    setSaving('save');
    try {
      const response = await request('PUT', path(row.host, '/rule'), ruleBody(draft, original, gazelle ? row.rule?.minGlobalRatio ?? null : undefined));
      if (response.status === 204) {
        await onRuleSaved();
        return;
      }
      if (response.status === 400) {
        const body = await response.json() as { error: string; field: string | null; reason: string };
        if (body.reason !== undefined) return fail({ field: problemField(body.error, body.field), reason: body.reason });
      }
      fail({ field: null, reason: 'The rule could not be saved. Try again.' });
    } catch {
      fail({ field: null, reason: noAnswer });
    } finally {
      setSaving(undefined);
    }
  };

  const restoreEnvRule = async () => {
    setSaving('env');
    setRuleError(undefined);
    try {
      const response = await request('DELETE', path(row.host, '/rule'));
      if (response.status === 204) await onRuleSaved();
      else setRuleError({ field: null, reason: 'The Settings copy could not be deleted. Try again.' });
    } catch {
      setRuleError({ field: null, reason: noAnswer });
    } finally {
      setSaving(undefined);
    }
  };

  const remove = async () => {
    setRemoving(true);
    setRemoveProblem(undefined);
    try {
      const response = await request('DELETE', path(row.host));
      if (response.status === 204) {
        setRemoveOpen(undefined);
        onRemoved();
      } else if (response.status === 409) setRemoveOpen('refused');
      else setRemoveProblem(`${name} could not be removed. Try again.`);
    } catch {
      setRemoveProblem(noAnswer);
    } finally {
      setRemoving(false);
    }
  };

  const connectionPill = () => {
    if (testing !== undefined) return <StatusServicePill logo={null} name={null} state="testing" className={pillOnly}>Testing</StatusServicePill>;
    if (connection.kind === 'too_old') return <StatusRulePill tone="warning">No account stats</StatusRulePill>;
    if (connection.kind === 'ok') return <StatusServicePill logo={null} name={null} state="connected" className={pillOnly}>Connected</StatusServicePill>;
    if (connection.kind === 'rejected' || connection.kind === 'unreachable') {
      return <StatusServicePill logo={null} name={null} state="failed" className={pillOnly}>{connectionFailure({ ...row, connection })}</StatusServicePill>;
    }
    return <StatusServicePill logo={null} name={null} state="not-set-up" className={pillOnly}>Not set up</StatusServicePill>;
  };

  const accountSummary = testing !== undefined
    ? `Testing ${row.host}${typed ? ` with this ${credential}` : row.credentialSet ? ` with the saved ${credential}` : ''}. Takes up to 10 seconds.`
    : typed ? `Connect tests the new ${credential}, then saves it. If the test fails, nothing changes.`
      : row.credentialSet ? 'Nothing to save. Change the token and Connect tests it before saving.'
        : `Connect tests the ${credential}, then saves it.`;

  const pill = rulePill(row);
  const ratioSet = draft.ratio.trim() !== '';
  const shownEnvRule = row.ruleSource === 'settings' && row.envRule === true;
  const ruleSummary = ruleError !== undefined ? 'Not saved. Fix the field marked in red.'
    : edited ? 'Save rule checks each field, then saves. If a field is wrong, nothing changes.'
      : row.status === 'no_rule' ? 'Fill in a seed time or a ratio, then Save rule.'
        : row.status === 'configured_env' ? 'Nothing to save. Saving a change makes a Settings copy of this rule.'
          : 'Nothing to save. Change a field, then Save rule.';
  const globalHelp = gazelle ? 'Read from the site\'s own required ratio.'
    : row.software === 'other' ? 'Your ratio across the whole account. Near or under this, removal advice says keep seeding.'
      : connection.kind === 'too_old' ? 'Your ratio across the whole account. This site can\'t share it, so removal advice shows it as unknown.'
        : `Your ratio across the whole account, read with the ${credential}. Near or under this, removal advice says keep seeding.`;
  const singleBand = draft.bands.length === 1;
  const editableCount = draft.bands.filter((band) => band.kind === 'edit').length;

  return (
    <section
      aria-labelledby={`tracker-${row.host}`}
      className="flex flex-col gap-6 rounded-lg border border-border p-6 transition-opacity duration-(--duration-base) ease-out starting:opacity-0"
    >
      <div className="flex items-center gap-3">
        <TrackerMark host={row.host} size="header" />
        <h2 id={`tracker-${row.host}`} className="min-w-0 flex-1 truncate font-ui text-base font-bold text-foreground">{name}</h2>
        {named && <span className="font-data text-sm text-muted-foreground">{row.host}</span>}
        <Button variant="outline-destructive" icon={<Trash2 />} onClick={() => setRemoveOpen(row.status === 'configured_env' || row.envRule === true ? 'refused' : 'confirm')}>
          Remove tracker
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h3 className="font-ui text-sm font-semibold text-foreground">Account connection</h3>
            {row.software !== 'other' && connectionPill()}
          </div>
          <p className="font-ui text-[13px] text-muted-foreground">Site software: {softwareLabels[row.software]}</p>
        </div>
        {row.software === 'other'
          ? <CalloutInfo title="No account connection for this software">Only the hit and run rule is used.</CalloutInfo>
          : (
            <>
              <FieldLabelled
                label={credential}
                error={connection.kind === 'rejected'
                  ? `${name} refused this ${credential}. Paste a new one ${row.software === 'unit3d' ? 'from your profile\'s API key page' : 'from your account settings on the site'}.`
                  : connection.kind === 'unreachable' ? `Nothing answered at ${row.host} within 10 seconds.` : undefined}
                help={typed ? <span className="text-muted-foreground">New {credential}, not saved yet.</span> : locked ? `Saved. ${credentialSource(row.software)}` : credentialSource(row.software)}
                action={row.credentialSet && (
                  <Button variant="outline" disabled={testing !== undefined} onClick={() => { setReplacing(!replacing); setSecret(''); setFormCheck(undefined); }}>
                    {locked ? 'Replace' : `Keep saved ${credential}`}
                  </Button>
                )}
              >
                {locked
                  // The key makes React build a new input, so a typed secret never lingers in the locked one.
                  ? <InputSearch key="locked" variant="field" readOnly value="" icon={<Lock aria-hidden="true" />} placeholder="••••••••••••••••••••" wrapperClassName="bg-muted" aria-label={credential} />
                  : (
                    <InputSearch
                      key="open"
                      variant="field"
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      autoFocus={replacing}
                      placeholder={`Paste the ${credential}`}
                      value={secret}
                      readOnly={testing !== undefined}
                      aria-invalid={connection.kind === 'rejected' || undefined}
                      onValueChange={(value) => setSecret(value)}
                    />
                  )}
              </FieldLabelled>
              {connection.kind === 'too_old' && (
                <Callout look="warning" title="This site's UNIT3D is older than version 8.3.4, so it can't share your account stats">
                  The token is saved. The hit and run rule still works; removal advice shows your global ratio as unknown.
                </Callout>
              )}
              {stats !== undefined && statFacts(stats).length > 0 && (
                <dl className="flex flex-wrap gap-x-8 gap-y-3 py-2">
                  {statFacts(stats).map((fact) => <Fact key={fact.label} label={fact.label}>{fact.value}</Fact>)}
                </dl>
              )}
              {row.credentialSet && checkedAt !== undefined && formCheck === undefined && (
                <dl className="flex flex-col">
                  <FactRow label="Last checked" note={`${ago(checkedAt, now)}, every 5 min`}>Today {timeOf(checkedAt)}</FactRow>
                </dl>
              )}
              <BarBottomAction
                summary={accountSummary}
                secondary={typed
                  ? <Button variant="outline" icon={<Undo2 />} disabled={testing !== undefined} onClick={() => { setSecret(''); setFormCheck(undefined); }}>Discard edits</Button>
                  : row.credentialSet && (
                    <Button variant="ghost" icon={<RefreshCw />} loading={testing === 'check'} disabled={testing === 'connect'} onClick={() => void test('check')}>Check now</Button>
                  )}
                action={(
                  <Button size="large" icon={<Plug />} loading={testing === 'connect'} disabled={!typed || testing === 'check'} onClick={() => void test('connect')}>
                    {testing === 'connect' ? 'Testing…' : 'Connect'}
                  </Button>
                )}
              />
              {connectionProblem !== undefined && <Callout title={connectionProblem} />}
            </>
          )}
      </div>

      <div className="flex flex-col gap-5 border-t border-border pt-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h3 className="font-ui text-sm font-semibold text-foreground">Hit and run rule</h3>
            <StatusRulePill tone={pill.warning ? 'warning' : 'default'}>{pill.text}</StatusRulePill>
          </div>
          <p className="font-ui text-[13px] text-muted-foreground">
            Decides when {aTorrentOf(row.host)} can be removed without a hit and run. Removal advice checks it when you delete a version.
          </p>
        </div>

        {row.problem !== null && <Callout title={row.problem}>Save a new rule to replace it.</Callout>}
        {row.status === 'no_rule' && row.problem === null && (
          <Callout look="warning" title="Torrents from this tracker keep seeding until it has a rule">
            When you delete a version, removal advice says "Can't tell; keep seeding" for {everyTorrentOf(row.host)} until a rule is saved.
          </Callout>
        )}
        {row.status === 'configured_env' && (
          <CalloutInfo icon={<FileText />} title="This rule comes from the env file on the server">
            Change a field and save, and media-manager-2 keeps a copy in Settings that takes over from the env file. The env file itself is not changed.
          </CalloutInfo>
        )}
        {shownEnvRule && (
          <CalloutInfo icon={<FileText />} title="This rule is a Settings copy. It takes over from the env file's rule.">
            The env file on the server also has a rule for {name}. Use env file rule deletes this copy, and the env file's rule applies again.
          </CalloutInfo>
        )}

        <div className="flex flex-col gap-2">
          <span className="font-ui text-[13px] font-semibold text-foreground">Seed time</span>
          <div className="flex flex-col gap-2">
            {draft.bands.map((band, index) => {
              const previous = draft.bands[index - 1];
              const from = previous === undefined ? undefined : previous.kind === 'locked' ? previous.row.upToGB : previous.upToGB.trim();
              const last = index === draft.bands.length - 1;
              const lead = singleBand ? 'Any size:' : `Above ${from || '…'} GB:`;
              if (band.kind === 'locked') {
                return (
                  <div key={index} className="flex h-(--control-h-default) items-center gap-2 font-ui text-sm text-muted-foreground">
                    <Lock aria-hidden="true" className="size-3.5 shrink-0" />
                    {singleBand ? 'Any size' : previous === undefined ? `Up to ${band.row.upToGB} GB` : `Above ${from} GB`}: size-based curve (set in the env file)
                  </div>
                );
              }
              const bandError = errorAt(`seedHours[${index}]`) ?? errorAt(`seedHours[${index}].upToGB`) ?? errorAt(`seedHours[${index}].hours`) ?? errorAt(`seedHours[${index}].perGB`);
              return (
                <div key={index} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    {last
                      ? <span className={cn('shrink-0 font-ui text-sm text-foreground', singleBand ? 'w-24' : 'w-36.75')}>{lead}</span>
                      : (
                        <FieldNumber
                          before="Up to"
                          after="GB:"
                          value={band.upToGB}
                          aria-invalid={errorAt(`seedHours[${index}].upToGB`) !== undefined || undefined}
                          onValueChange={(value) => setBand(index, { ...band, upToGB: value })}
                        />
                      )}
                    <FieldNumber
                      after="hours +"
                      value={band.hours}
                      aria-invalid={errorAt(`seedHours[${index}].hours`) !== undefined || undefined}
                      onValueChange={(value) => setBand(index, { ...band, hours: value })}
                    />
                    <FieldNumber
                      after="per GB"
                      value={band.perGB}
                      aria-invalid={errorAt(`seedHours[${index}].perGB`) !== undefined || undefined}
                      onValueChange={(value) => setBand(index, { ...band, perGB: value })}
                    />
                    {!singleBand && editableCount > 1 && (
                      <Button
                        variant="ghost"
                        iconOnly
                        icon={<X className="text-muted-foreground" />}
                        aria-label="Remove size band"
                        onClick={() => setDraft({ ...draft, bands: draft.bands.filter((_, at) => at !== index) })}
                      />
                    )}
                  </div>
                  {bandError !== undefined && <p className="font-ui text-xs text-destructive">{bandError}</p>}
                </div>
              );
            })}
          </div>
          <p className="font-ui text-xs text-subtle-foreground">Seed time by torrent size. One row is one fixed time for every size.</p>
          {errorAt('seedHours') !== undefined && <p className="font-ui text-xs text-destructive">{errorAt('seedHours')}</p>}
          <Button variant="outline" size="row" icon={<Plus />} className="self-start" onClick={() => setDraft({ ...draft, bands: addBand(draft.bands) })}>Add size band</Button>
        </div>

        <div className={cn('grid gap-4', ratioSet ? 'grid-cols-3' : 'grid-cols-2')}>
          <FieldLabelledOptional label="Ratio that also clears it" help="This torrent's upload divided by its download." error={errorAt('ratio')}>
            <InputSearch
              variant="field"
              inputMode="decimal"
              autoComplete="off"
              className="font-data"
              value={draft.ratio}
              aria-invalid={errorAt('ratio') !== undefined || undefined}
              onValueChange={(value) => setDraft({ ...draft, ratio: value })}
            />
          </FieldLabelledOptional>
          {ratioSet && (
            <FieldLabelled label="Seed time and ratio" help="Either: whichever comes first. Both: the torrent needs the seed time and the ratio." error={errorAt('logic')}>
              <ToggleGroup aria-label="Seed time and ratio" value={draft.logic} onValueChange={(value) => setDraft({ ...draft, logic: value as 'or' | 'and' })} className="flex-none!">
                <ToggleGroupItem value="or">Either clears it</ToggleGroupItem>
                <ToggleGroupItem value="and">Both needed</ToggleGroupItem>
              </ToggleGroup>
            </FieldLabelled>
          )}
          <FieldLabelledOptional label="Global ratio minimum" help={globalHelp} error={errorAt('minGlobalRatio')}>
            <InputSearch
              variant="field"
              inputMode="decimal"
              autoComplete="off"
              className="font-data"
              disabled={gazelle}
              value={gazelle ? (stats?.requiredRatio == null ? '' : stats.requiredRatio.toFixed(2)) : draft.minGlobalRatio}
              aria-invalid={errorAt('minGlobalRatio') !== undefined || undefined}
              onValueChange={(value) => setDraft({ ...draft, minGlobalRatio: value })}
            />
          </FieldLabelledOptional>
        </div>

        <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
          <CollapsibleTrigger summary={moreOpen ? undefined : moreSummary(draft)} className="rounded-none border-t border-border px-0">More</CollapsibleTrigger>
          <CollapsibleContent className="grid grid-cols-2 gap-8 pt-5 pr-0 pl-6">
            <MoreGroup title="Partly downloaded torrents" description="For a torrent that never finished downloading. The seed time above doesn't apply to it.">
              <MoreNumber before="Not a hit and run below" after="% downloaded" field="partial.exemptBelow" value={draft.exemptBelowPercent} error={errorAt('partial.exemptBelow')} onChange={(value) => setDraft({ ...draft, exemptBelowPercent: value })} />
              <MoreNumber before="Cleared at ratio" after="of the data downloaded" field="partial.ratio" value={draft.partialRatio} error={errorAt('partial.ratio')} onChange={(value) => setDraft({ ...draft, partialRatio: value })} />
              <MoreNumber before="Or after" after="days of seeding" field="partial.maxHours" value={draft.maxDays} error={errorAt('partial.maxHours')} onChange={(value) => setDraft({ ...draft, maxDays: value })} />
            </MoreGroup>
            <MoreGroup title="Removal advice margin" description="How far past the rule a torrent must be before removal advice says it can go. The larger seed time extra applies.">
              <MoreNumber after="% extra seed time" field="margins.timePercent" value={draft.timePercent} error={errorAt('margins.timePercent')} onChange={(value) => setDraft({ ...draft, timePercent: value })} />
              <MoreNumber before="At least" after="extra hours" field="margins.extraHours" value={draft.extraHours} error={errorAt('margins.extraHours')} onChange={(value) => setDraft({ ...draft, extraHours: value })} />
              <MoreNumber after="extra ratio" field="margins.ratioExtra" value={draft.ratioExtra} error={errorAt('margins.ratioExtra')} onChange={(value) => setDraft({ ...draft, ratioExtra: value })} />
              <MoreNumber after="% above the global ratio minimum" field="margins.globalPercent" value={draft.globalPercent} error={errorAt('margins.globalPercent')} onChange={(value) => setDraft({ ...draft, globalPercent: value })} />
            </MoreGroup>
          </CollapsibleContent>
        </Collapsible>

        {ruleError !== undefined && !knownFields.has(ruleError.field ?? '') && (
          <Callout title={ruleError.field === null ? ruleError.reason : `The rule was not saved: ${ruleError.reason}`} />
        )}

        <BarBottomAction
          summary={ruleSummary}
          unsavedNote={edited ? 'Unsaved edits' : undefined}
          secondary={edited
            ? <Button variant="outline" icon={<Undo2 />} disabled={saving !== undefined} onClick={() => { setRuleError(undefined); onDraft(undefined); }}>Discard edits</Button>
            : shownEnvRule && <Button variant="ghost" icon={<FileText />} loading={saving === 'env'} disabled={saving === 'save'} onClick={() => void restoreEnvRule()}>Use env file rule</Button>}
          action={(
            <Button
              size="large"
              icon={<Save />}
              loading={saving === 'save'}
              disabled={!edited || (row.status === 'no_rule' && !hasAnyRule(draft)) || saving === 'env'}
              onClick={() => void saveRule()}
            >
              Save rule
            </Button>
          )}
        />
      </div>

      <Dialog
        open={removeOpen === 'confirm'}
        onOpenChange={(open) => { if (!open) setRemoveOpen(undefined); }}
        title={`Remove ${name}?`}
        subject={`media-manager-2 forgets ${row.host} and its hit and run rule. Torrents and files are not touched. Removal advice then says "Can't tell; keep seeding" for ${named ? `${name} torrents` : `torrents from ${row.host}`}.`}
        footerCallout={removeProblem === undefined ? undefined : <Callout title={removeProblem} />}
        actions={(
          <>
            <Button variant="outline" size="large" onClick={() => setRemoveOpen(undefined)}>Cancel</Button>
            <Button variant="destructive" size="large" loading={removing} onClick={() => void remove()}>Remove tracker</Button>
          </>
        )}
      />
      <Dialog
        open={removeOpen === 'refused'}
        onOpenChange={(open) => { if (!open) setRemoveOpen(undefined); }}
        title={`${name} can't be removed here`}
        subject="Its rule comes from the env file on the server. Remove it from the env file instead."
        actions={<Button variant="outline" size="large" onClick={() => setRemoveOpen(undefined)}>Close</Button>}
      />
    </section>
  );
}

function MoreGroup({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h4 className="font-ui text-[13px] font-semibold text-foreground">{title}</h4>
        <p className="font-ui text-xs leading-[1.45] text-subtle-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

type MoreNumberProps = { before?: string; after: string; field: string; value: string; error: string | undefined; onChange: (value: string) => void };

function MoreNumber({ before, after, field, value, error, onChange }: MoreNumberProps) {
  return (
    <div className="flex flex-col gap-1.5" data-field={field}>
      <FieldNumber before={before} after={after} value={value} aria-invalid={error !== undefined || undefined} onValueChange={onChange} />
      {error !== undefined && <p className="font-ui text-xs text-destructive">{error}</p>}
    </div>
  );
}
