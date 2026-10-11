import { ArrowRight, Copy, DatabaseBackup, Download, KeyRound, Lock, Save } from 'lucide-react';
import { useState } from 'react';
import { BarBottomAction } from '@/components/ui/bar-bottom-action';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { FactRow } from '@/components/ui/fact';
import { FieldLabelled } from '@/components/ui/field-labelled';
import { FieldLabelledOptional } from '@/components/ui/field-labelled-optional';
import { InputSearch } from '@/components/ui/input-search';
import { OptionRow } from '@/components/ui/option-row';
import { Radio, RadioGroup } from '@/components/ui/radio';
import { StatusServicePill } from '@/components/ui/status-service-pill';
import { backupBody, backupComplete, type BackupDraft, backupEdited, backupPill, clearSentKeys, emptyBackupDraft, type SetupStatus } from './setup';
import type { TrackerRequest } from './TrackerEditor';

const noAnswer = 'media-manager-2 did not answer. Try again.';
// The service pill's own logo and name are off here: its first two children are hidden, the dot stays.
const pillOnly = '[&>span:nth-child(-n+2)]:hidden';

type BackupField = 'folder' | 'endpoint' | 'bucket' | 'accessKeyId' | 'secretAccessKey';
type KeyField = 'accessKeyId' | 'secretAccessKey';

type Wizard = { title: string; step: string; onSkip: () => void; onContinue: () => void };

/** The pane for the backup destination. `request` sends one request under /api/setup; `wizard` makes it a setup step. */
export function BackupEditor({ backup, request, onSaved, onKeyCreated, wizard }: {
  backup: SetupStatus['backup'];
  request: TrackerRequest;
  onSaved: () => void;
  onKeyCreated: () => void;
  wizard?: Wizard;
}) {
  const [draft, setDraft] = useState(() => emptyBackupDraft(backup.destination));
  const [replacing, setReplacing] = useState<Record<KeyField, boolean>>({ accessKeyId: false, secretAccessKey: false });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<BackupField, string>>>({});
  const [problem, setProblem] = useState<string>();
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<{ restoreKey: string; createdAt: number }>();
  const [creatingKey, setCreatingKey] = useState(false);
  const [copied, setCopied] = useState(false);
  // The wizard holds Finish setup until the new restore key has been copied or downloaded.
  const [keySaved, setKeySaved] = useState(false);
  const [confirmingNewKey, setConfirmingNewKey] = useState(false);

  const edited = backupEdited(draft, backup.destination);
  const complete = backupComplete(draft);
  const anyError = Object.values(fieldErrors).some((error) => error !== undefined);
  const savedBucket = backup.destination?.kind === 's3';
  // An empty form with no destination yet is not an edit.
  const unsaved = edited && (backup.destination !== null || complete);
  const pill = unsaved ? { state: 'unsaved' as const, text: 'Unsaved edits' } : backupPill(backup);

  const change = (field: Exclude<keyof BackupDraft, 'kind'>, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const save = async () => {
    setPending(true);
    setFieldErrors({});
    setProblem(undefined);
    try {
      const response = await request('POST', '/backup', backupBody(draft));
      if (response.status === 204) {
        // The same bucket with new keys reads back unchanged, so the parent does not remount this pane: drop the sent keys here.
        setDraft(clearSentKeys);
        setReplacing({ accessKeyId: false, secretAccessKey: false });
        onSaved();
        return;
      }
      if (response.status === 400) {
        const body = await response.json() as { error: string; field?: BackupField; reason?: string };
        if (body.error === 'invalid_backup' && body.field !== undefined) {
          setFieldErrors({ [body.field]: body.reason });
          return;
        }
      }
      setProblem('The backup destination could not be saved. Try again.');
    } catch {
      setProblem(noAnswer);
    } finally {
      setPending(false);
    }
  };

  const createKey = async () => {
    setCreatingKey(true);
    setProblem(undefined);
    try {
      const response = await request('POST', '/backup/key');
      if (response.status === 201) {
        setCreated(await response.json() as { restoreKey: string; createdAt: number });
        onKeyCreated();
        return;
      }
      setProblem('The restore key could not be created. Try again.');
    } catch {
      setProblem(noAnswer);
    } finally {
      setCreatingKey(false);
    }
  };

  const noKey = backup.key === 'missing' || backup.key === 'invalid';
  // In the wizard a saved destination moves on, once a key can lock the backups.
  const canFinish = wizard !== undefined && !edited && backup.destination !== null;
  const verb = wizard === undefined ? 'Confirm' : 'Save and continue';
  const summary = pending ? 'Saving the destination.'
    : canFinish && created !== undefined ? (keySaved ? 'The first backup runs within 5 minutes.' : 'Copy or download the restore key, then finish setup.')
    : canFinish ? (noKey ? 'Destination saved. Backups start once you create a key.' : 'The first backup runs within 5 minutes.')
    : created !== undefined ? 'Save the restore key first. To change the destination, leave Backup and open it again.'
    : anyError ? 'Not saved. Fix the field marked in red.'
      : !edited ? `Nothing to save. Change a field, then ${verb}.`
        : !complete ? (draft.kind === 'folder' ? `Enter the folder, then ${verb}.` : `Fill in the endpoint, bucket and both keys, then ${verb}.`)
          : draft.kind === 'folder' ? `${verb} checks the folder exists, saves it and turns backups on.`
            : `${verb} saves the bucket and turns backups on. It is not tested here; the next backup run and the health check report a bucket that refuses.`;

  const plain = { autoComplete: 'off', spellCheck: false, readOnly: pending };
  // The restore-key callouts wait for a destination, and give way to the key once it is created.
  const keyCallout = backup.destination !== null && created === undefined;
  const createButton = <Button variant="outline" icon={<KeyRound />} loading={creatingKey} disabled={pending} onClick={() => void createKey()}>Create key</Button>;
  // In the wizard the missing and invalid key callouts drop their button: the footer carries Create key instead.
  const noKeyAction = wizard === undefined ? createButton : undefined;

  const keyField = (key: KeyField, label: string, type: 'text' | 'password') => {
    const locked = savedBucket && !replacing[key];
    return (
      <FieldLabelled
        label={label}
        error={fieldErrors[key]}
        help={locked ? 'Saved. Enter it again to change the bucket.' : undefined}
        action={savedBucket && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              setReplacing((current) => ({ ...current, [key]: locked }));
              if (!locked) change(key, '');
            }}
          >
            {locked ? 'Replace' : 'Keep saved key'}
          </Button>
        )}
      >
        {locked
          // The key makes React build a new input, so a typed secret never lingers in the locked one.
          ? <InputSearch key="locked" variant="field" readOnly value="" icon={<Lock aria-hidden="true" />} placeholder="••••••••••••••••••••" wrapperClassName="bg-muted" aria-label={label} />
          : (
            <InputSearch
              key="open"
              variant="field"
              type={type}
              {...plain}
              autoFocus={replacing[key]}
              value={draft[key]}
              aria-invalid={fieldErrors[key] !== undefined || undefined}
              onValueChange={(value) => change(key, value)}
            />
          )}
      </FieldLabelled>
    );
  };

  return (
    <section
      aria-labelledby="backup-editor"
      className="flex flex-col gap-6 rounded-lg border border-border p-6 transition-opacity duration-(--duration-base) ease-out starting:opacity-0"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground [&>svg]:size-4"><DatabaseBackup /></span>
        <h2 id="backup-editor" className="font-ui text-base font-bold text-foreground">{wizard?.title ?? 'Backup'}</h2>
        <StatusServicePill logo={null} name={null} state={pill.state} className={pillOnly}>{pill.text}</StatusServicePill>
        {wizard !== undefined && <span className="ml-auto font-data text-[13px] text-muted-foreground">{wizard.step}</span>}
      </div>

      {keyCallout && backup.key === 'missing' && (
        <Callout look="warning" title="Backups can't run until you create a key" action={noKeyAction}>
          The key locks every backup. You see its restore key once, so have your password manager ready.
        </Callout>
      )}
      {keyCallout && backup.key === 'invalid' && (
        <Callout title="Backups can't run: BACKUP_KEY is not valid" action={noKeyAction}>
          Create a restore key here instead. Once one exists the env file's key is no longer read.
        </Callout>
      )}
      {keyCallout && backup.key === 'env' && (
        <Callout look="info" title="Using BACKUP_KEY from the env file" action={createButton}>
          Backups keep using it until you create a key here. Backups made before then still need BACKUP_KEY to restore.
        </Callout>
      )}
      {created !== undefined && (
        <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h3 className="font-ui text-sm font-semibold">Save your restore key</h3>
          <p className="font-ui text-[13px] text-muted-foreground">
            You need this key to restore a backup. It is shown once and never stored on this server, so save it in your password manager now.
          </p>
          <InputSearch variant="field" className="font-data" aria-label="Restore key" readOnly value={created.restoreKey} />
          <div className="flex gap-2">
            <Button
              variant="outline"
              icon={<Copy />}
              onClick={() => void (navigator.clipboard?.writeText(created.restoreKey) ?? Promise.reject(new Error('No clipboard'))).then(
                () => {
                  setCopied(true);
                  setKeySaved(true);
                },
                () => setProblem('The key could not be copied. Select it and copy it by hand, or download it.'),
              )}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              variant="outline"
              icon={<Download />}
              onClick={() => {
                const url = URL.createObjectURL(new Blob([`${created.restoreKey}\n`], { type: 'text/plain' }));
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = 'media-manager-2-restore-key.txt';
                anchor.click();
                setKeySaved(true);
                setTimeout(() => URL.revokeObjectURL(url));
              }}
            >
              Download
            </Button>
          </div>
        </section>
      )}
      {backup.problem !== null && <Callout title={backup.problem}>Confirm a destination to replace it.</Callout>}

      <RadioGroup
        aria-label="Where backups go"
        className="grid grid-cols-2 gap-2"
        value={draft.kind}
        onValueChange={(value) => {
          setDraft((current) => ({ ...current, kind: value as BackupDraft['kind'] }));
          setFieldErrors({});
        }}
      >
        <OptionRow
          control={<Radio value="folder" />}
          title="A folder"
          description="On this server, or a drive or share mounted on it."
          bordered
        />
        <OptionRow
          control={<Radio value="s3" />}
          title="An S3-compatible bucket"
          description="Cloudflare R2, Backblaze B2, Amazon S3, Wasabi, MinIO or any other S3 API."
          bordered
        />
      </RadioGroup>

      {draft.kind === 'folder' ? (
        <FieldLabelled
          label="Backup folder"
          help="An absolute path that already exists. A missing folder fails the backup instead of filling this server's disk."
          error={fieldErrors.folder}
        >
          <InputSearch
            variant="field"
            className="font-data"
            {...plain}
            value={draft.folder}
            aria-invalid={fieldErrors.folder !== undefined || undefined}
            onValueChange={(value) => change('folder', value)}
          />
        </FieldLabelled>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <FieldLabelled label="Endpoint" help="The service's S3 endpoint, such as https://s3.us-west-004.backblazeb2.com." error={fieldErrors.endpoint}>
            <InputSearch
              variant="field"
              type="url"
              inputMode="url"
              className="font-data"
              {...plain}
              value={draft.endpoint}
              aria-invalid={fieldErrors.endpoint !== undefined || undefined}
              onValueChange={(value) => change('endpoint', value)}
            />
          </FieldLabelled>
          <FieldLabelled label="Bucket" help="The bucket that holds the backups." error={fieldErrors.bucket}>
            <InputSearch
              variant="field"
              className="font-data"
              {...plain}
              value={draft.bucket}
              aria-invalid={fieldErrors.bucket !== undefined || undefined}
              onValueChange={(value) => change('bucket', value)}
            />
          </FieldLabelled>
          <FieldLabelledOptional label="Region" help="Default auto, which suits Cloudflare R2; most other services need their real region, such as us-west-004.">
            <InputSearch variant="field" className="font-data" {...plain} value={draft.region} onValueChange={(value) => change('region', value)} />
          </FieldLabelledOptional>
          {keyField('accessKeyId', 'Access key ID', 'text')}
          {keyField('secretAccessKey', 'Secret access key', 'password')}
        </div>
      )}

      <dl className="flex flex-col">
        <FactRow label="How often">Every 5 minutes</FactRow>
        {backup.key === 'pair' && backup.keyCreatedAt !== null && (
          <FactRow
            label="Restore key"
            note={created === undefined && !creatingKey && !pending && !confirmingNewKey
              ? <Button variant="outline" size="row" icon={<KeyRound />} onClick={() => setConfirmingNewKey(true)}>Create new key</Button>
              : undefined}
          >
            Created {new Date(backup.keyCreatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, not stored here
          </FactRow>
        )}
      </dl>
      {confirmingNewKey && (
        <Callout
          look="warning"
          title="Replace the restore key?"
          action={(
            <div className="flex gap-2">
              <Button
                icon={<KeyRound />}
                loading={creatingKey}
                onClick={() => {
                  setConfirmingNewKey(false);
                  void createKey();
                }}
              >
                Create new key
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingNewKey(false)}>Keep this key</Button>
            </div>
          )}
        >
          Backups made from now on use the new key. Backups made before still need the key you have now, so keep it.
        </Callout>
      )}

      <BarBottomAction
        summary={summary}
        unsavedNote={unsaved && !pending ? 'Unsaved edits' : undefined}
        // Once a destination is saved and a key exists, skipping would turn working backups off, so the button goes.
        secondary={wizard !== undefined && !(canFinish && !noKey) && <Button variant="outline" disabled={pending || creatingKey} onClick={wizard.onSkip}>Skip backup</Button>}
        action={canFinish && noKey
          ? <Button size="large" icon={<KeyRound />} loading={creatingKey} disabled={pending || created !== undefined} onClick={() => void createKey()}>Create key</Button>
          : canFinish
          ? <Button size="large" icon={<ArrowRight />} disabled={noKey || creatingKey || (created !== undefined && !keySaved)} onClick={wizard.onContinue}>Finish setup</Button>
          : (
            <Button size="large" icon={<Save />} loading={pending} disabled={!complete || !edited || pending || creatingKey || created !== undefined} onClick={() => void save()}>
              {wizard === undefined ? 'Confirm' : 'Save and continue'}
            </Button>
          )}
      />
      {problem !== undefined && <Callout title={problem} />}
    </section>
  );
}
