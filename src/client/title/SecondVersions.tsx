import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { CardChoice } from '@/components/ui/card-choice';
import { Dialog } from '@/components/ui/dialog';
import { trackerName } from '@/components/ui/logo';
import { RadioGroup } from '@/components/ui/radio';
import { RowSecondVersion } from '@/components/ui/row-second-version';
import { type DownloadCircleState, StatusDownloadCircle } from '@/components/ui/status-download-circle';
import { cn } from '@/lib/utils';
import { formatBytes } from '../downloads/model';
import type { SecondVersion, SecondVersionDeleted } from '../library/api';
import { useAdvice } from './advice';
import { hitAndRunText, keepChoiceText, removeChoiceText } from './secondVersionText';

// "720p" from "720p WEB-DL", as the dialog names a version.
const resolution = (quality: string | null) => (quality === null ? null : /\d{3,4}p/i.exec(quality)?.[0] ?? quality);
const addedFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const addedDay = (ms: number) => (Number.isFinite(ms) ? addedFormat.format(ms) : '');
const sizeText = (version: SecondVersion) => (version.sizeBytes === null ? '' : formatBytes(version.sizeBytes));
const deletable = (version: SecondVersion) => version.state === 'imported' || version.state === 'failed';
const tracker = (version: SecondVersion) => trackerName(version.seeding?.trackerHost ?? version.indexer);

type ChipLook = { label: string; variant?: 'neutral' | 'plain' | 'risk' | 'warning'; circle?: DownloadCircleState; percent?: number; spinner?: boolean };

/** One status chip in a row's Status column: live is muted with black words and the download circle, plain has no fill. */
export function StatusChip({ look }: { look: ChipLook }) {
  const live = look.circle === 'downloading' || look.circle === 'importing';
  return (
    <Badge
      variant={look.variant === 'plain' ? 'neutral' : look.variant ?? 'neutral'}
      spinner={look.spinner}
      icon={look.circle === undefined ? undefined : <StatusDownloadCircle state={look.circle} percent={look.percent ?? 0} />}
      className={cn('max-w-full transition-colors duration-(--duration-base) ease-out [&>span]:truncate', live && 'text-foreground', look.variant === 'plain' && 'bg-transparent')}
    >
      <span>{look.label}</span>
    </Badge>
  );
}

/** Seeding against the tracker's rule: muted while the rule is unmet, no fill once met. */
export const seedingLook = (rule: SecondVersion['hitAndRun']): ChipLook => (rule?.met ? { label: 'Seeding · rule met', variant: 'plain' } : { label: 'Seeding' });

const versionLook = (version: SecondVersion): ChipLook => {
  if (version.state === 'sending') return { label: 'Sending', spinner: true };
  if (version.state === 'downloading' && version.stalled) {
    return { label: version.percent === null ? 'Stalled' : `Stalled · ${version.percent}%`, variant: 'risk', circle: 'stalled', percent: version.percent ?? 0 };
  }
  if (version.state === 'downloading') return { label: version.percent === null ? 'Downloading' : `Downloading ${version.percent}%`, circle: 'downloading', percent: version.percent ?? 0 };
  if (version.state === 'importing') return { label: 'Importing', circle: 'importing' };
  if (version.state === 'failed' && version.failureCode === 'stalled_removed') return { label: 'Stalled, removed', variant: 'warning' };
  if (version.state === 'failed') return { label: 'Failed', variant: 'risk' };
  if (version.hash === null || version.seeding === null || !version.seeding.inRtorrent) return { label: 'No torrent', variant: 'plain' };
  return seedingLook(version.hitAndRun);
};

// The design's words for a stalled torrent removed with nothing downloaded; other failures show the server's own reason.
const failureText = (version: SecondVersion) => (version.failureCode === 'stalled_removed' ? 'Nothing downloaded; torrent removed' : version.failure);

type Outcome = { look: 'risk' | 'warning'; title: string; body?: string; done: boolean };

function DeleteSecondVersion({ version, subject, trackedQuality, onClose, onChanged, onUnauthenticated }: {
  version: SecondVersion;
  subject: string | null;
  trackedQuality: string | null;
  onClose: () => void;
  onChanged: (versions: SecondVersion[] | ((current: SecondVersion[]) => SecondVersion[])) => void;
  onUnauthenticated: () => void;
}) {
  const [choice, setChoice] = useState<'keep' | 'remove'>('keep');
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // Only a torrent rTorrent still holds, or one behind an imported file, has a choice to make.
  const choices = version.hash !== null && (version.path !== null || version.seeding?.inRtorrent === true);
  const advice = useAdvice(choices ? version.hash : null, onUnauthenticated);
  const name = tracker(version);
  // The advice has no seeded hours when rTorrent no longer holds the torrent.
  const noHistory = version.seeding === null || !version.seeding.inRtorrent || (advice?.kind === 'ready' && advice.advice.seededHours === null);

  let keep: string | undefined;
  let remove: string | undefined;
  if (noHistory) {
    keep = 'Keeping it is the safe choice.';
    remove = advice?.kind === 'ready' ? advice.advice.reason : 'Seeding time unknown (torrent not in rTorrent)';
  } else if (advice?.kind === 'failed') {
    keep = 'Keeping it is the safe choice.';
    remove = 'The hit and run rule could not be checked.';
  } else if (advice?.kind === 'ready') {
    keep = keepChoiceText(advice.advice, name, version.hitAndRun?.requiredHours ?? null);
    remove = removeChoiceText(advice.advice, name);
  } else {
    keep = 'Checking the hit and run rule.';
  }

  // Held until the reply is fully read, so a second press cannot send another delete.
  const confirm = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    try {
      await send();
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  const send = async () => {
    const removeTorrent = choices && choice === 'remove';
    setOutcome(null);
    const response = await fetch(`/api/second-versions/${version.id}`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'media-manager-2', Accept: 'application/json' },
      body: JSON.stringify({ removeTorrent }),
    }).catch(() => null);
    if (response === null) {
      setOutcome({ look: 'risk', title: "media-manager-2 didn't answer.", body: 'Reload the page to see whether the second version was deleted.', done: false });
      return;
    }
    if (response.status === 401) {
      onUnauthenticated();
      return;
    }
    if (response.status === 404) {
      onChanged((current) => current.filter((row) => row.id !== version.id));
      setOutcome({ look: 'warning', title: 'This second version was already deleted.', done: true });
      return;
    }
    const body = await response.json().catch(() => ({})) as Partial<SecondVersionDeleted> & { reason?: unknown };
    if (response.status === 409 && typeof body.reason === 'string') {
      setOutcome({ look: 'risk', title: 'Nothing was deleted.', body: body.reason, done: false });
      return;
    }
    if (!response.ok || body.secondVersions === undefined || body.torrent === undefined) {
      setOutcome({ look: 'risk', title: `media-manager-2 could not delete it (error ${response.status}).`, done: false });
      return;
    }
    onChanged(body.secondVersions);
    if (removeTorrent && !body.torrent.removed) {
      setOutcome({ look: 'warning', title: 'The second version was deleted, but its torrent was kept.', body: body.torrent.reason, done: true });
      return;
    }
    onClose();
  };

  const quality = version.quality === '' ? '' : `${resolution(version.quality)} `;
  const tracked = resolution(trackedQuality);
  const what = [subject, resolution(version.quality), sizeText(version)].filter((part) => part !== null && part !== '').join(' · ');
  const callouts = [
    choices && noHistory && (
      <Callout key="history" look="warning" title="No seeding record, so keep the torrent to be safe.">
        rTorrent has no history for this torrent, so the hit and run rule can't be checked.
      </Callout>
    ),
    outcome !== null && <Callout key="outcome" look={outcome.look} title={outcome.title}>{outcome.body}</Callout>,
  ].filter(Boolean);

  return (
    <Dialog
      open
      onOpenChange={(next) => { if (!next && !sending) onClose(); }}
      title={`Delete the ${quality}second version?`}
      subject={`${what}.${tracked === null ? '' : ` The ${tracked} tracked version is not touched.`}`}
      scrollEdges
      footerCallout={callouts.length === 0 ? undefined : <div className="flex flex-col gap-2">{callouts}</div>}
      actions={outcome?.done ? <Button size="large" onClick={onClose}>Done</Button> : (
        <>
          <Button variant="outline" disabled={sending} onClick={onClose}>Cancel</Button>
          <Button variant="destructive" size="large" loading={sending} onClick={() => void confirm()}>
            {!choices ? 'Delete second version' : choice === 'keep' ? 'Delete file, keep seeding' : 'Delete file and torrent'}
          </Button>
        </>
      )}
    >
      {choices ? (
        <RadioGroup value={choice} onValueChange={(value) => setChoice(value as 'keep' | 'remove')} disabled={sending} className="flex flex-col gap-2">
          <CardChoice value="keep" title="Keep seeding the torrent" description={keep} />
          <CardChoice value="remove" title="Remove the torrent too" description={remove} />
        </RadioGroup>
      ) : (
        <p className="m-0 font-ui text-sm text-muted-foreground">
          {version.hash === null ? 'This second version has no torrent, so only its row is cleared.' : 'Its torrent is no longer in rTorrent, so only its row is cleared.'}
        </p>
      )}
    </Dialog>
  );
}

/**
 * Second-version rows for one movie or episode, under its tracked version, with the delete dialog.
 * `subject` names the movie or episode in the dialog ("S02E04").
 */
export function SecondVersionRows({ versions, inset, subject, trackedQuality, onChanged, onUnauthenticated }: {
  versions: SecondVersion[];
  /** Under an open episode. */
  inset: boolean;
  subject: string | null;
  trackedQuality: string | null;
  onChanged: (versions: SecondVersion[] | ((current: SecondVersion[]) => SecondVersion[])) => void;
  onUnauthenticated: () => void;
}) {
  const [deleting, setDeleting] = useState<SecondVersion | null>(null);
  return (
    <>
      {versions.map((version) => (
        <RowSecondVersion
          key={version.id}
          inset={inset}
          title={`Second version · added ${addedDay(version.addedAt)}`}
          release={version.releaseTitle}
          group={version.group}
          detail={version.state === 'failed' && failureText(version) !== null
            ? <span className={version.failureCode === 'stalled_removed' ? 'text-warning' : 'text-destructive'}>{failureText(version)}</span>
            : undefined}
          hitAndRun={hitAndRunText(version.hitAndRun)}
          tracker={tracker(version)}
          status={<StatusChip look={versionLook(version)} />}
          quality={version.quality}
          size={sizeText(version)}
          actions={deletable(version) && <Button size="row" variant="outline-destructive" onClick={() => setDeleting(version)}>Delete</Button>}
        />
      ))}
      {deleting !== null && (
        <DeleteSecondVersion
          version={deleting}
          subject={subject}
          trackedQuality={trackedQuality}
          onClose={() => setDeleting(null)}
          onChanged={onChanged}
          onUnauthenticated={onUnauthenticated}
        />
      )}
    </>
  );
}
