import { ArrowLeft, ArrowRight, Lock } from 'lucide-react';
import { useState } from 'react';
import { BarBottomAction } from '@/components/ui/bar-bottom-action';
import { Button } from '@/components/ui/button';
import { FactRow } from '@/components/ui/fact';
import { FieldLabelled } from '@/components/ui/field-labelled';
import { InputSearch } from '@/components/ui/input-search';
import { Logo } from '@/components/ui/logo';
import { StatusServicePill } from '@/components/ui/status-service-pill';
import { PRODUCT_NAME } from '@/productName';
import type { SetupStatus } from './setup';
import type { TrackerRequest } from './TrackerEditor';

const noAnswer = `${PRODUCT_NAME} did not answer. Try again.`;
const keyRefused = 'Jellyfin refused this key. Check it in Dashboard > API Keys.';
// The service pill's own logo and name are off here: its first two children are hidden, the dot stays.
const pillOnly = '[&>span:nth-child(-n+2)]:hidden';

/** The wizard's media-server step for a Jellyfin owner: the facts from the first-run page, then the API key. `request` sends one request under /api/setup. */
export function JellyfinEditor({ status, connected, version, request, wizard, onSaved }: {
  status: Extract<SetupStatus['mediaServer'], { kind: 'jellyfin' }>;
  connected: boolean;
  /** Jellyfin's version from the last check that answered. */
  version?: string;
  request: TrackerRequest;
  wizard: { step: string; onBack: () => void };
  onSaved: () => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [replacing, setReplacing] = useState(false);
  // A saved key stays locked until Replace, and Continue moves on without a new test.
  const locked = connected && !replacing;
  const pill = error === keyRefused ? { state: 'failed' as const, text: 'Key refused' }
    : connected ? { state: 'connected' as const, text: `Connected${version === undefined ? '' : ` · ${version}`}` }
      : { state: 'not-set-up' as const, text: 'Needs API key' };

  // POST /jellyfin answers the key's test result: ok (saved), rejected, unreachable or not_configured (nothing saved).
  const connect = async () => {
    setPending(true);
    setError(undefined);
    try {
      const response = await request('POST', '/jellyfin', { apiKey: apiKey.trim() });
      const kind = response.ok ? (await response.json() as { kind?: string }).kind : undefined;
      if (kind === 'ok') {
        onSaved();
        return;
      }
      setError(kind === 'rejected' ? keyRefused
        : kind === 'unreachable' ? 'Jellyfin didn’t answer in 10 s. Check that it’s running.'
          : noAnswer);
    } catch {
      setError(noAnswer);
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      aria-labelledby="jellyfin-editor"
      className="flex flex-col gap-6 rounded-lg border border-border p-6 transition-opacity duration-(--duration-base) ease-out starting:opacity-0"
    >
      <div className="flex items-center gap-3">
        <Logo name="jellyfin" alt="" className="size-8" />
        <h2 id="jellyfin-editor" className="font-ui text-base font-bold text-foreground">Connect Jellyfin</h2>
        <StatusServicePill logo={null} name={null} state={pill.state} className={pillOnly}>{pill.text}</StatusServicePill>
        <span className="ml-auto font-data text-[13px] text-muted-foreground">{wizard.step}</span>
      </div>

      <dl className="flex flex-col">
        <FactRow label="Media server" note="picked on the first-run page">Jellyfin</FactRow>
        <FactRow label="Address" note="locked: only the owner can change it">{status.url}</FactRow>
        <FactRow label="Owner" note="Jellyfin administrator, logged in">{status.ownerName}</FactRow>
      </dl>

      <FieldLabelled
        label="API key"
        error={error}
        help={locked ? 'Saved. In Jellyfin: Dashboard > API Keys.' : `Create one in Jellyfin under Dashboard > API Keys. ${PRODUCT_NAME} uses it to check the server and scan new folders.`}
        action={locked && <Button variant="outline" onClick={() => setReplacing(true)}>Replace</Button>}
      >
        {locked ? (
          <InputSearch key="locked" variant="field" readOnly value="" icon={<Lock aria-hidden="true" />} placeholder="••••••••••••••••••••" wrapperClassName="bg-muted" />
        ) : (
          <InputSearch
            key="open"
            variant="field"
            type="password"
            className="font-data"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste the key"
            value={apiKey}
            readOnly={pending}
            aria-invalid={error !== undefined || undefined}
            onValueChange={(value) => { setApiKey(value); setError(undefined); }}
          />
        )}
      </FieldLabelled>

      <BarBottomAction
        summary={locked ? 'Saved. Continue to Folders.' : 'Connect tests the key, saves it, then moves to Folders.'}
        secondary={<Button variant="outline" icon={<ArrowLeft />} disabled={pending} onClick={wizard.onBack}>Back</Button>}
        action={locked
          ? <Button size="large" icon={<ArrowRight />} onClick={onSaved}>Continue</Button>
          : <Button size="large" icon={<ArrowRight />} loading={pending} disabled={apiKey.trim() === '' || pending} onClick={() => void connect()}>Connect and continue</Button>}
      />
    </section>
  );
}
