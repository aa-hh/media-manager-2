import { CircleCheck, CircleX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { CardChoice } from '@/components/ui/card-choice';
import { Dialog } from '@/components/ui/dialog';
import { trackerName } from '@/components/ui/logo';
import { Progress } from '@/components/ui/progress';
import { RadioGroup } from '@/components/ui/radio';
import { RowSecondVersion } from '@/components/ui/row-second-version';
import { formatBytes } from '../downloads/model';
import type { SecondVersion, SecondVersionDeleted } from '../library/api';
import { adviceReason, unknownHistory, useAdvice } from './advice';
import { seedingText } from './EpisodeDetails';

// The failure text src/server/stalls.ts (STALLED_REMOVED) records when it removed a stalled torrent that had downloaded nothing.
const STALLED_REMOVED = 'Stalled with nothing downloaded; torrent removed.';

const addedDay = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const sizeText = (version: SecondVersion) => (version.sizeBytes === null ? '' : formatBytes(version.sizeBytes));
const deletable = (version: SecondVersion) => version.state === 'imported' || version.state === 'failed';
const tracker = (version: SecondVersion) => trackerName(version.seeding?.trackerHost ?? version.indexer);

const badge = (version: SecondVersion): { label: string; variant?: 'live' | 'risk' | 'warning'; icon?: ReactNode; spinner?: boolean } => {
  if (version.state === 'sending') return { label: 'Sending', spinner: true };
  if (version.state === 'downloading') return { label: version.percent === null ? 'Downloading' : `Downloading ${version.percent}%`, variant: 'live' };
  if (version.state === 'importing') return { label: 'Importing', spinner: true };
  if (version.state === 'failed' && version.failure === STALLED_REMOVED) return { label: 'Stalled, removed', variant: 'warning', icon: <CircleCheck /> };
  if (version.state === 'failed') return { label: 'Failed', variant: 'risk', icon: <CircleX /> };
  return { label: 'Second version' };
};

const seedingCell = (version: SecondVersion): ReactNode => {
  if (version.state === 'downloading') return version.percent === null ? '' : <Progress value={version.percent} className="w-25" aria-label="Downloaded" />;
  if (version.hash === null || version.seeding?.inRtorrent === false) return 'no torrent';
  if (version.seeding === null) return '';
  return seedingText({ ...version.seeding, trackerHost: version.seeding.trackerHost ?? '' });
};

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
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // Only a torrent rTorrent still holds, or one behind an imported file, has a choice to make.
  const choices = version.hash !== null && (version.path !== null || version.seeding?.inRtorrent === true);
  const advice = useAdvice(choices ? version.hash : null, onUnauthenticated);
  const name = tracker(version);
  const noHistory = version.seeding === null || !version.seeding.inRtorrent || (advice?.kind === 'ready' && unknownHistory(advice.advice.reason));

  let keep: string | undefined;
  let remove: string | undefined;
  if (noHistory) {
    keep = 'Keeping it is the safe choice.';
    remove = advice?.kind === 'ready' ? advice.advice.reason : 'Seeding time unknown (torrent not in rTorrent)';
  } else if (advice?.kind === 'failed') {
    keep = 'Keeping it is the safe choice.';
    remove = 'The hit and run rule could not be checked.';
  } else if (advice?.kind === 'ready') {
    const { recommendation, reason, globalRatio } = advice.advice;
    const ruleMet = reason.startsWith('Hit and run rule met');
    keep = recommendation === 'safe' ? 'The torrent keeps seeding in rTorrent.' : `Recommended: ${adviceReason(reason)}`;
    if (globalRatio !== null) keep = `${keep}. ${globalRatio}.`;
    if (recommendation === 'safe') remove = `Recommended: ${reason}`;
    else if (recommendation === 'keep') remove = ruleMet && globalRatio !== null ? `${globalRatio}.` : `Breaks the ${name} rule`;
    else remove = "The hit and run rule can't be confirmed.";
  } else {
    keep = 'Checking the hit and run rule.';
  }

  const confirm = async () => {
    const removeTorrent = choices && choice === 'remove';
    setSending(true);
    setOutcome(null);
    const response = await fetch(`/api/second-versions/${version.id}`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'media-manager-2', Accept: 'application/json' },
      body: JSON.stringify({ removeTorrent }),
    }).catch(() => null);
    setSending(false);
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

  const quality = version.quality === '' ? '' : `${version.quality} `;
  const what = [subject, version.quality, sizeText(version)].filter((part) => part !== null && part !== '').join(' · ');
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
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={`Delete the ${quality}second version?`}
      subject={`${what}.${trackedQuality === null ? '' : ` The ${trackedQuality} tracked version is not touched.`}`}
      scrollEdges
      footerCallout={callouts.length === 0 ? undefined : <div className="flex flex-col gap-2">{callouts}</div>}
      actions={outcome?.done ? <Button size="large" onClick={onClose}>Done</Button> : (
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" size="large" loading={sending} onClick={() => void confirm()}>
            {!choices ? 'Delete second version' : choice === 'keep' ? 'Delete file, keep seeding' : 'Delete file and torrent'}
          </Button>
        </>
      )}
    >
      {choices ? (
        <RadioGroup value={choice} onValueChange={(value) => setChoice(value as 'keep' | 'remove')} className="flex flex-col gap-2">
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
export function SecondVersionRows({ versions, indent, subject, trackedQuality, onChanged, onUnauthenticated }: {
  versions: SecondVersion[];
  indent: boolean;
  subject: string | null;
  trackedQuality: string | null;
  onChanged: (versions: SecondVersion[] | ((current: SecondVersion[]) => SecondVersion[])) => void;
  onUnauthenticated: () => void;
}) {
  const [deleting, setDeleting] = useState<SecondVersion | null>(null);
  return (
    <>
      {versions.map((version) => {
        const look = badge(version);
        return (
          <RowSecondVersion
            key={version.id}
            indent={indent}
            title={`Second version · added ${addedDay(version.addedAt)}`}
            label={look.label}
            labelVariant={look.variant}
            labelIcon={look.icon}
            labelSpinner={look.spinner}
            quality={version.quality}
            release={version.releaseTitle}
            detail={version.state === 'failed' && version.failure !== null
              ? <span className={version.failure === STALLED_REMOVED ? 'text-warning' : 'text-destructive'}>{version.failure}</span>
              : undefined}
            size={sizeText(version)}
            tracker={tracker(version)}
            seeding={seedingCell(version)}
            actions={deletable(version) && <Button size="row" variant="outline-destructive" onClick={() => setDeleting(version)}>Delete</Button>}
          />
        );
      })}
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
