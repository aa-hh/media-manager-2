import { ArrowLeft, ArrowRight, Folder, RefreshCw, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { BarBottomAction } from '@/components/ui/bar-bottom-action';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { FieldLabelled } from '@/components/ui/field-labelled';
import { InputSearch } from '@/components/ui/input-search';
import { SkeletonRowTwoLine } from '@/components/ui/skeleton';
import { StatusServicePill } from '@/components/ui/status-service-pill';
import { folderBody, folderDraft, folderFields, type FolderField, type FoldersRead, type FolderValues, foldersEdited } from './setup';
import type { TrackerRequest } from './TrackerEditor';

const noAnswer = 'media-manager-2 did not answer. Try again.';
// The service pill's own logo and name are off here: its first two children are hidden, the dot stays.
const pillOnly = '[&>span:nth-child(-n+2)]:hidden';

type Read = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; read: FoldersRead };

type Wizard = { title: string; step: string; onBack: () => void; onContinue: () => void };

/** The pane for the six host folders. `request` sends one request under /api/setup; `wizard` makes it a setup step. */
export function FoldersEditor({ request, onSaved, wizard }: {
  request: TrackerRequest;
  onSaved: (saved: FolderValues, warnings: Partial<Record<FolderField, string>>) => void;
  wizard?: Wizard;
}) {
  const [state, setState] = useState<Read>({ kind: 'loading' });
  const [draft, setDraft] = useState<FolderValues>();
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FolderField, string>>>({});
  const [warnings, setWarnings] = useState<Partial<Record<FolderField, string>>>({});
  const [problem, setProblem] = useState<string>();
  const [pending, setPending] = useState(false);

  // Reading waits on Sonarr, Radarr and rTorrent for the suggestions, so it can take seconds.
  const read = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const response = await request('GET', '/folders');
      if (!response.ok) throw new Error('Folders could not be read.');
      setState({ kind: 'ready', read: await response.json() as FoldersRead });
    } catch {
      setState({ kind: 'failed' });
    }
  }, [request]);

  useEffect(() => { void read(); }, [read]);

  // The pane's own frame and heading while the services answer, so the fields arrive in place instead of pushing in.
  if (state.kind === 'loading') {
    return (
      <section aria-labelledby="folders-editor" aria-busy="true" className="flex flex-col gap-6 rounded-lg border border-border p-6">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground [&>svg]:size-4"><Folder /></span>
          <h2 id="folders-editor" className="font-ui text-base font-bold text-foreground">{wizard?.title ?? 'Folders'}</h2>
          {wizard !== undefined && <span className="ml-auto font-data text-[13px] text-muted-foreground">{wizard.step}</span>}
        </div>
        <p className="font-ui text-sm text-muted-foreground">Reading the folders from Sonarr, Radarr and rTorrent. This can take a few seconds.</p>
        <div className="grid grid-cols-2 gap-x-4"><SkeletonRowTwoLine /><SkeletonRowTwoLine /><SkeletonRowTwoLine /><SkeletonRowTwoLine /><SkeletonRowTwoLine /><SkeletonRowTwoLine /></div>
      </section>
    );
  }
  if (state.kind === 'failed') {
    return (
      <Callout title="Folders could not be read" action={<Button variant="outline" icon={<RefreshCw />} onClick={() => void read()}>Retry</Button>}>
        Check that media-manager-2 is running, then retry.
      </Callout>
    );
  }

  const { saved } = state.read;
  const values = draft ?? folderDraft(state.read);
  const edited = foldersEdited(values, saved);
  const anyError = Object.values(fieldErrors).some((error) => error !== undefined);
  const anyBlank = folderFields.some(({ field }) => values[field].trim() === '');
  // Suggestions nobody has touched yet are not the owner's edits.
  const suggestedOnly = draft === undefined && Object.values(saved).every((value) => value === null);
  const pill = suggestedOnly ? { state: 'not-set-up' as const, text: 'Read from services' }
    : edited ? { state: 'unsaved' as const, text: 'Unsaved edits' }
    : Object.values(saved).every((value) => value !== null) ? { state: 'connected' as const, text: 'Saved' }
      : { state: 'not-set-up' as const, text: 'Not set up' };
  const warned = folderFields.filter(({ field }) => warnings[field] !== undefined);

  const change = (field: FolderField, value: string) => {
    setDraft({ ...values, [field]: value });
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setWarnings({});
  };

  const save = async () => {
    const sent = folderBody(values);
    setPending(true);
    setFieldErrors({});
    setProblem(undefined);
    try {
      const response = await request('POST', '/folders', sent);
      if (response.status === 200) {
        const body = await response.json() as { warnings: Partial<Record<FolderField, string>> };
        setWarnings(body.warnings);
        setState((current) => (current.kind === 'ready' ? { kind: 'ready', read: { ...current.read, saved: sent } } : current));
        onSaved(sent, body.warnings);
        return;
      }
      if (response.status === 400) {
        const body = await response.json() as { error: string; fields?: Partial<Record<FolderField, string>> };
        if (body.error === 'invalid_folders' && body.fields !== undefined) {
          setFieldErrors(body.fields);
          return;
        }
      }
      setProblem('The folders could not be saved. Try again.');
    } catch {
      setProblem(noAnswer);
    } finally {
      setPending(false);
    }
  };

  const allSaved = Object.values(saved).every((value) => value !== null);
  const summary = pending ? 'Checking each folder exists, then saving.'
    : anyError ? 'Not saved. Fix the fields marked in red.'
      : edited ? 'Confirm checks each folder exists, then saves. If one fails, nothing changes.'
        : wizard !== undefined && allSaved ? 'Folders saved. Continue moves on.'
          : 'Nothing to save. Change a folder, then Confirm.';

  return (
    <section
      aria-labelledby="folders-editor"
      className="flex flex-col gap-6 rounded-lg border border-border p-6 transition-opacity duration-(--duration-base) ease-out starting:opacity-0"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground [&>svg]:size-4"><Folder /></span>
        <h2 id="folders-editor" className="font-ui text-base font-bold text-foreground">{wizard?.title ?? 'Folders'}</h2>
        <StatusServicePill logo={null} name={null} state={pill.state} className={pillOnly}>{pill.text}</StatusServicePill>
        {wizard !== undefined && <span className="ml-auto font-data text-[13px] text-muted-foreground">{wizard.step}</span>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {folderFields.map(({ field, label, help }) => (
          <FieldLabelled key={field} label={label} help={help} error={fieldErrors[field]}>
            <InputSearch
              variant="field"
              className="font-data"
              autoComplete="off"
              spellCheck={false}
              value={values[field]}
              readOnly={pending}
              aria-invalid={fieldErrors[field] !== undefined || undefined}
              onValueChange={(value) => change(field, value)}
            />
          </FieldLabelled>
        ))}
      </div>

      {warned.length > 0 && (
        <Callout look="warning" title="Saved, with a warning" className="[overflow-wrap:anywhere]">
          {warned.map(({ field, label }) => `${label}: ${warnings[field]}`).join(' ')}
        </Callout>
      )}
      {problem !== undefined && <Callout title={problem} />}

      <BarBottomAction
        summary={summary}
        unsavedNote={edited && !pending && !suggestedOnly ? 'Unsaved edits' : undefined}
        secondary={wizard !== undefined && <Button variant="outline" icon={<ArrowLeft />} disabled={pending} onClick={wizard.onBack}>Back</Button>}
        action={wizard !== undefined && !edited && allSaved
          ? <Button size="large" icon={<ArrowRight />} onClick={wizard.onContinue}>Continue</Button>
          : (
            <Button size="large" icon={<Save />} loading={pending} disabled={!edited || anyBlank || pending} onClick={() => void save()}>
              {wizard === undefined ? 'Confirm' : 'Confirm and continue'}
            </Button>
          )}
      />
    </section>
  );
}
