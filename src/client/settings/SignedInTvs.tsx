import { Tv } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { LabelGroup } from '@/components/ui/label-group';
import { RowSignedInTv } from '@/components/ui/row-signed-in-tv';
import { Skeleton } from '@/components/ui/skeleton';
import { useToastManager } from '@/components/ui/toast';
import { type SignedInTv, TV_SESSION_DAYS, tvDates } from './devices';
import { writeHeaders } from './useServices';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; tvs: SignedInTv[] };

/** Settings, Signed-in TVs: the TVs signed in with a Plex link code, each with Sign out. Browsers are never listed. */
export function SignedInTvs({ now, onUnauthenticated }: { now: number; onUnauthenticated: () => void }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  // The TV the dialog names; kept after it closes so the closing dialog does not go blank.
  const [asking, setAsking] = useState<SignedInTv>();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const busy = useRef(false);
  const toasts = useToastManager();
  const unauthorizedRef = useRef(onUnauthenticated);
  unauthorizedRef.current = onUnauthenticated;

  const read = useCallback(async () => {
    try {
      const response = await fetch('/api/devices', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (response.status === 401) return unauthorizedRef.current();
      if (!response.ok) return setLoad({ kind: 'failed' });
      const { devices } = await response.json() as { devices: SignedInTv[] };
      setLoad({ kind: 'ready', tvs: devices });
    } catch {
      setLoad({ kind: 'failed' });
    }
  }, []);

  useEffect(() => {
    void read();
  }, [read]);

  const signOut = async (tv: SignedInTv) => {
    // The ref, not the state, so a second press or Enter before the re-render sends nothing.
    if (busy.current) return;
    busy.current = true;
    setSigningOut(true);
    const failed = { title: `${tv.name} could not be signed out`, description: 'Check that media-manager-2 is running, then try again.', type: 'error' as const };
    try {
      const response = await fetch(`/api/devices/${encodeURIComponent(tv.id)}/sign-out`, { method: 'POST', credentials: 'same-origin', headers: writeHeaders, body: '{}' });
      if (response.status === 401) {
        unauthorizedRef.current();
        return;
      }
      // 404: it was already signed out (or expired) elsewhere, so it leaves the list all the same.
      if (response.ok || response.status === 404) {
        setLoad((previous) => (previous.kind === 'ready' ? { kind: 'ready', tvs: previous.tvs.filter((other) => other.id !== tv.id) } : previous));
        setOpen(false);
      } else {
        toasts.add(failed);
      }
    } catch {
      toasts.add(failed);
    } finally {
      busy.current = false;
      setSigningOut(false);
    }
  };

  return (
    <>
      <LabelGroup count={load.kind === 'ready' && load.tvs.length > 0 ? load.tvs.length : undefined}>Signed-in TVs</LabelGroup>
      {load.kind === 'loading' && (
        <div role="status" aria-label="Loading" className="flex flex-col gap-1.5 px-4 py-2.5">
          <Skeleton className="w-35" />
          <Skeleton className="h-3 w-50" />
        </div>
      )}
      {load.kind === 'failed' && (
        <div className="flex flex-col items-start gap-2 px-4 py-2">
          <p className="font-ui text-[13px] leading-[1.5] text-muted-foreground">Signed-in TVs could not be read.</p>
          <Button variant="outline" size="row" onClick={() => { setLoad({ kind: 'loading' }); void read(); }}>Try again</Button>
        </div>
      )}
      {load.kind === 'ready' && load.tvs.length === 0 && (
        <div className="rounded-lg border border-border">
          <EmptyState icon={<Tv />} title="No TVs signed in">
            Open media-manager-2 on a TV and sign in there with a Plex link code. It will show up here.
          </EmptyState>
        </div>
      )}
      {load.kind === 'ready' && load.tvs.length > 0 && (
        <>
          {load.tvs.map((tv) => (
            <RowSignedInTv key={tv.id} name={tv.name} dates={tvDates(tv, now)} disabled={signingOut} onSignOut={() => { setAsking(tv); setOpen(true); }} />
          ))}
          <p className="px-4 py-2 font-ui text-[13px] text-muted-foreground">A TV stays signed in for {TV_SESSION_DAYS} days after it was last used.</p>
        </>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => { if (!next && !busy.current) setOpen(false); }}
        title={asking === undefined ? '' : `Sign out ${asking.name}?`}
        subject={asking === undefined ? undefined : tvDates(asking, now)}
        actions={(
          <>
            <Button variant="outline" size="large" disabled={signingOut} onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="large" loading={signingOut} onClick={() => { if (asking !== undefined) void signOut(asking); }}>Sign out</Button>
          </>
        )}
      >
        <p className="font-ui text-sm leading-[1.5] text-muted-foreground">
          The TV goes back to the sign-in screen the next time it is used. To sign it in again, enter a new Plex link code on plex.tv/link.
        </p>
      </Dialog>
    </>
  );
}
