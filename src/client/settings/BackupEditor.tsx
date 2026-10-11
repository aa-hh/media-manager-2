import { DatabaseBackup, Lock, Save } from 'lucide-react';
import { useState } from 'react';
import { BarBottomAction } from '@/components/ui/bar-bottom-action';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { CardChoice } from '@/components/ui/card-choice';
import { FactRow } from '@/components/ui/fact';
import { FieldLabelled } from '@/components/ui/field-labelled';
import { FieldLabelledOptional } from '@/components/ui/field-labelled-optional';
import { InputSearch } from '@/components/ui/input-search';
import { RadioGroup } from '@/components/ui/radio';
import { StatusServicePill } from '@/components/ui/status-service-pill';
import { backupBody, backupComplete, type BackupDraft, backupEdited, backupPill, emptyBackupDraft, type SetupStatus } from './setup';
import type { TrackerRequest } from './TrackerEditor';

const noAnswer = 'media-manager-2 did not answer. Try again.';
// The service pill's own logo and name are off here: its first two children are hidden, the dot stays.
const pillOnly = '[&>span:nth-child(-n+2)]:hidden';

type BackupField = 'folder' | 'endpoint' | 'bucket' | 'accessKeyId' | 'secretAccessKey';
type KeyField = 'accessKeyId' | 'secretAccessKey';

/** The pane for the backup destination. `request` sends one request under /api/setup. */
export function BackupEditor({ backup, request, onSaved }: { backup: SetupStatus['backup']; request: TrackerRequest; onSaved: () => void }) {
  const [draft, setDraft] = useState(() => emptyBackupDraft(backup.destination));
  const [replacing, setReplacing] = useState<Record<KeyField, boolean>>({ accessKeyId: false, secretAccessKey: false });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<BackupField, string>>>({});
  const [problem, setProblem] = useState<string>();
  const [pending, setPending] = useState(false);

  const edited = backupEdited(draft, backup.destination);
  const complete = backupComplete(draft);
  const anyError = Object.values(fieldErrors).some((error) => error !== undefined);
  const savedBucket = backup.destination?.kind === 's3';
  const pill = edited ? { state: 'unsaved' as const, text: 'Unsaved edits' } : backupPill(backup);

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

  const summary = pending ? 'Saving the destination.'
    : anyError ? 'Not saved. Fix the field marked in red.'
      : !complete ? (draft.kind === 'folder' ? 'Enter the folder, then Confirm.' : 'Fill in the endpoint, bucket and both keys, then Confirm.')
        : !edited ? 'Nothing to save. Change a field, then Confirm.'
          : draft.kind === 'folder' ? 'Confirm checks the folder exists, saves it and turns backups on.'
            : 'Confirm saves the bucket and turns backups on. It is not tested here; the next backup run and the health check report a bucket that refuses.';

  const plain = { autoComplete: 'off', spellCheck: false, readOnly: pending };

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
        <h2 id="backup-editor" className="font-ui text-base font-bold text-foreground">Backup</h2>
        <StatusServicePill logo={null} name={null} state={pill.state} className={pillOnly}>{pill.text}</StatusServicePill>
      </div>

      {backup.key === 'missing' && (
        <Callout look="warning" title="Backups can't run yet: BACKUP_KEY is not set">
          Add BACKUP_KEY to the env file on the server (64 hex characters; the README's Backups section shows how to make one), then restart media-manager-2. Every backup is encrypted with it, and a restore needs the same key.
        </Callout>
      )}
      {backup.key === 'invalid' && (
        <Callout title="Backups can't run: BACKUP_KEY is not valid">
          It must be 64 hex characters. Fix it in the env file on the server, then restart media-manager-2.
        </Callout>
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
        <CardChoice value="folder" title="A folder" description="On this server, or a drive or share mounted on it." />
        <CardChoice value="s3" title="An S3-compatible bucket" description="Cloudflare R2, Backblaze B2, Amazon S3, Wasabi, MinIO or any other S3 API." />
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
        <FactRow label="Encryption">BACKUP_KEY from the env file</FactRow>
      </dl>

      <BarBottomAction
        summary={summary}
        unsavedNote={edited && !pending ? 'Unsaved edits' : undefined}
        action={(
          <Button size="large" icon={<Save />} loading={pending} disabled={!complete || !edited || pending} onClick={() => void save()}>
            Confirm
          </Button>
        )}
      />
      {problem !== undefined && <Callout title={problem} />}
    </section>
  );
}
