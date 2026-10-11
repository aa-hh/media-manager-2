import { BookmarkX, FileVideo, HardDrive, Trash2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, type CalloutLook } from '@/components/ui/callout';
import { CardChoice } from '@/components/ui/card-choice';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { LabelGroup } from '@/components/ui/label-group';
import { Logo, trackerLogo, trackerName } from '@/components/ui/logo';
import { RadioGroup } from '@/components/ui/radio';
import { RowDeleteStep } from '@/components/ui/row-delete-step';
import { RowDeleteTorrent } from '@/components/ui/row-delete-torrent';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatBytes } from '../downloads/model';
import { getJson, postJson, type DeleteChoices, type DeletePlan, type DeleteRan, type DeletePlanTorrent, type RemovalAdvice } from '../library/api';
import { navigate } from '../navigation';
import {
  adviceLine, deleteActionText, deleteBase, deleteChoices, deleteResultRows, deleteResultTitle, deleteSubjectText, deleteTitleText,
  torrentHoldsText, versionGroups, versionHoldsText, type DeleteTarget, type MovieMode, type VersionChoice, type VersionGroup,
} from './secondVersionText';

type Load = { kind: 'loading' } | { kind: 'ready'; plan: DeletePlan } | { kind: 'failed'; message: string };
type Notice = { look: CalloutLook; title: string; body?: string };
type Done = { plan: DeletePlan; choices: DeleteChoices; ran: DeleteRan };

const tracker = (host: string | null) => (host === null ? 'The tracker' : trackerName(host));
const logo = (host: string | null) => {
  const name = host === null ? undefined : trackerLogo(host);
  return name === undefined ? null : <Logo name={name} alt="" />;
};
const baseName = (path: string) => path.split('/').pop() ?? path;
const advice = (value: RemovalAdvice, askedHours: number | null = null) => ({ look: value.recommendation, ...adviceLine(value, tracker(value.host), askedHours) });

function TorrentChoice({ remove, risky, disabled = false, onChange }: { remove: boolean; risky: boolean; disabled?: boolean; onChange: (remove: boolean) => void }) {
  return (
    <ToggleGroup value={remove ? 'remove' : 'keep'} onValueChange={(value) => onChange(value === 'remove')} disabled={disabled} aria-label="Torrent">
      <ToggleGroupItem value="keep">Keep seeding</ToggleGroupItem>
      <ToggleGroupItem value="remove" risk={risky}>Remove torrent</ToggleGroupItem>
    </ToggleGroup>
  );
}

function Section({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  return (
    <section className="flex w-full flex-col gap-2">
      <LabelGroup count={count} className="p-0">{label}</LabelGroup>
      {children}
    </section>
  );
}

/**
 * Delete a movie, a show or (by passing a season target) one season: the plan from the server, the owner's choices, then every step's result.
 * `name` titles the dialog while the plan loads; `codeOf` names an episode id ("S02E04") for second-version rows.
 */
export function DeleteTitle({ target, name, codeOf = () => null, onClose, onUnauthenticated }: {
  target: DeleteTarget;
  name: string;
  codeOf?: (episodeId: number) => string | null;
  onClose: () => void;
  onUnauthenticated: () => void;
}) {
  const base = deleteBase(target);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [reload, setReload] = useState(0);
  const [mode, setMode] = useState<MovieMode>('remove');
  const [removeTorrents, setRemoveTorrents] = useState<ReadonlySet<string>>(new Set());
  const [picks, setPicks] = useState<ReadonlyMap<string, VersionChoice>>(new Map());
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getJson<DeletePlan>(`${base}/delete-plan`, onUnauthenticated, controller.signal)
      .then((plan) => {
        // A fresh plan starts from its own defaults: torrents kept, second versions ticked and kept seeding.
        setRemoveTorrents(new Set());
        setPicks(new Map());
        setLoad({ kind: 'ready', plan });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoad({ kind: 'failed', message: error instanceof Error ? error.message : 'The request failed.' });
      });
    return () => controller.abort();
  }, [base, reload]);

  const service = target.kind === 'movie' ? 'radarr' : 'sonarr';
  const close = () => {
    onClose();
    if (done?.ran.deleted) navigate('/');
  };

  if (done !== null) {
    const rows = deleteResultRows(done.plan, done.choices, done.ran, tracker);
    return (
      <Dialog
        open
        onOpenChange={(next) => { if (!next) close(); }}
        title={deleteResultTitle(target, done.plan, done.ran.deleted)}
        subject={done.ran.deleted
          ? 'Every step, in the order it ran. This also appears under Deletions in the activity log.'
          : 'Every step, in the order it ran. Nothing after the failed step ran.'}
        scrollEdges
        actions={<Button size="large" onClick={close}>Done</Button>}
      >
        <div className="flex w-full flex-col">
          {rows.map((row, index) => <RowDeleteStep key={index} look={row.look} text={row.text} why={row.why} />)}
        </div>
      </Dialog>
    );
  }

  if (load.kind !== 'ready') {
    return (
      <Dialog
        open
        onOpenChange={(next) => { if (!next) onClose(); }}
        title={deleteTitleText(target, { service, title: name })}
        scrollEdges
        footerCallout={load.kind === 'failed' ? <Callout title="Couldn't check what this delete would touch.">{load.message}</Callout> : undefined}
        actions={(
          <>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="destructive" size="large" loading={load.kind === 'loading'} disabled>Delete</Button>
          </>
        )}
      >
        {load.kind === 'loading' && <p className="m-0 font-ui text-sm text-muted-foreground">Checking which torrents hold the files.</p>}
      </Dialog>
    );
  }

  const { plan } = load;
  const groups = versionGroups(plan);
  const choices = deleteChoices(target, mode, removeTorrents, groups, picks);
  const library = plan.torrents.filter((torrent) => !torrent.upgradedAway);
  const earlier = plan.torrents.filter((torrent) => torrent.upgradedAway);
  const unlinked = plan.files.filter((file) => file.note !== null);
  const pick = (group: VersionGroup) => picks.get(group.key) ?? { ticked: true, remove: false };
  const setPick = (group: VersionGroup, next: Partial<VersionChoice>) => setPicks(new Map(picks).set(group.key, { ...pick(group), ...next }));
  const setRemove = (hash: string, remove: boolean) => {
    const next = new Set(removeTorrents);
    if (remove) next.add(hash);
    else next.delete(hash);
    setRemoveTorrents(next);
  };

  const confirm = async () => {
    setSending(true);
    setNotice(null);
    const response = await postJson(`${base}/delete`, choices).catch(() => null);
    setSending(false);
    if (response === null) {
      setNotice({ look: 'risk', title: "media-manager-2 didn't answer.", body: 'Reload the page to see whether anything was deleted.' });
      return;
    }
    if (response.status === 401) {
      onUnauthenticated();
      return;
    }
    const body = await response.json().catch(() => ({})) as Partial<DeleteRan> & { error?: unknown; reason?: unknown };
    if (response.ok && body.steps !== undefined && body.deleted !== undefined) {
      setDone({ plan, choices, ran: { deleted: body.deleted, steps: body.steps } });
      return;
    }
    const reason = typeof body.reason === 'string' ? body.reason : undefined;
    if (response.status === 409 && body.error === 'plan_changed') {
      setNotice({ look: 'warning', title: 'Nothing was deleted: something changed since this dialog opened. The list is up to date now.', body: reason });
      setReload((count) => count + 1);
      return;
    }
    if (response.status === 409 && body.error === 'in_progress') {
      setNotice({ look: 'warning', title: 'A delete of this title is already running.', body: 'Wait for it to finish, then reload the page.' });
      return;
    }
    setNotice({ look: 'risk', title: `Nothing was deleted (error ${response.status}).`, body: reason ?? (typeof body.error === 'string' ? body.error : undefined) });
  };

  const torrentRow = (torrent: DeletePlanTorrent) => {
    const lead = logo(torrent.advice.host);
    const remove = removeTorrents.has(torrent.hash);
    return (
      <RowDeleteTorrent
        key={torrent.hash}
        lead={lead}
        marks={lead === null ? 0 : 1}
        name={torrent.name}
        size={formatBytes(torrent.sizeBytes)}
        holds={torrentHoldsText(target, torrent)}
        label={torrent.label !== null && <Badge>{torrent.label}</Badge>}
        advice={advice(torrent.advice)}
        locked={torrent.removal.allowed ? undefined : torrent.removal.reason}
        action={torrent.upgradedAway ? (
          <label className="flex shrink-0 items-center gap-2 px-1 font-ui text-[13px] font-medium text-foreground">
            <Checkbox checked={remove} onCheckedChange={(checked) => setRemove(torrent.hash, checked)} />
            Remove torrent
          </label>
        ) : <TorrentChoice remove={remove} risky={torrent.advice.recommendation !== 'safe'} onChange={(next) => setRemove(torrent.hash, next)} />}
      />
    );
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={deleteTitleText(target, plan)}
      subject={deleteSubjectText(target, plan, mode, formatBytes)}
      scrollEdges
      footerCallout={notice === null ? undefined : <Callout look={notice.look} title={notice.title}>{notice.body}</Callout>}
      actions={(
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" size="large" loading={sending} onClick={() => void confirm()}>{deleteActionText(target, mode, choices, groups)}</Button>
        </>
      )}
    >
      {target.kind === 'movie' && (
        <RadioGroup value={mode} onValueChange={(value) => setMode(value as MovieMode)} className="flex flex-col gap-2">
          <CardChoice value="remove" title="Remove from Radarr" description="Removes the movie and deletes its file." />
          <CardChoice value="keepUnmonitored" title="Keep in Radarr, unmonitored" description="Deletes the file and unmonitors the movie, so Radarr won't search for it again." />
        </RadioGroup>
      )}
      {target.kind === 'season' && (
        <p className="m-0 flex w-full gap-2 rounded-md bg-muted px-3 py-2.5 font-ui text-[13px] font-medium text-foreground">
          <BookmarkX aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {`Season ${target.seasonNumber} will be unmonitored, so Sonarr won't search for it again.`}
        </p>
      )}
      {library.length + unlinked.length > 0 && (
        <Section label={target.kind === 'movie' && plan.files.length === 1 ? 'Library file' : 'Library files'} count={plan.files.length}>
          {library.map(torrentRow)}
          {unlinked.map((file) => (
            <RowDeleteTorrent
              key={file.fileId}
              lead={<FileVideo aria-hidden="true" className="text-subtle-foreground" />}
              name={baseName(file.path)}
              size={formatBytes(file.sizeBytes)}
              holds={file.note}
            />
          ))}
        </Section>
      )}
      {groups.length > 0 && (
        <Section label="Second versions" count={plan.secondVersions.length}>
          {groups.map((group) => {
            const { ticked, remove } = pick(group);
            const first = group.rows[0];
            const host = first.seeding?.trackerHost ?? group.torrent?.advice.host ?? first.indexer;
            const mark = logo(host);
            return (
              <RowDeleteTorrent
                key={group.key}
                lead={(
                  <>
                    <Checkbox checked={ticked} onCheckedChange={(checked) => setPick(group, { ticked: checked })} aria-label={`Delete ${first.releaseTitle}`} />
                    {mark}
                  </>
                )}
                marks={mark === null ? 1 : 2}
                name={first.releaseTitle}
                size={formatBytes(group.rows.reduce((sum, row) => sum + (row.sizeBytes ?? 0), 0))}
                holds={versionHoldsText(target, group, codeOf)}
                advice={group.torrent === null ? undefined : advice(group.torrent.advice, first.hitAndRun?.requiredHours ?? null)}
                locked={group.torrent === null ? 'No torrent to remove' : group.torrent.removal.allowed ? undefined : group.torrent.removal.reason}
                action={group.torrent !== null && (
                  <TorrentChoice remove={remove} risky={group.torrent.advice.recommendation !== 'safe'} disabled={!ticked} onChange={(next) => setPick(group, { remove: next })} />
                )}
              />
            );
          })}
        </Section>
      )}
      {earlier.length > 0 && <Section label="Earlier downloads, not in the library" count={earlier.length}>{earlier.map(torrentRow)}</Section>}
      <div className="flex w-full flex-col gap-1.5 font-ui text-[13px] text-muted-foreground [&_svg]:mt-0.5 [&_svg]:size-3.5 [&_svg]:shrink-0">
        <p className="m-0 flex gap-2">
          <HardDrive aria-hidden="true" />
          Torrents you keep still use their disk space. The library files share that space, so deleting them frees nothing until the torrent is removed.
        </p>
        {plan.recycleBin !== null && (
          <p className="m-0 flex gap-2">
            <Trash2 aria-hidden="true" />
            {`${service === 'radarr' ? 'Radarr' : 'Sonarr'}'s recycle bin is on: the space is freed when it's emptied.`}
          </p>
        )}
      </div>
    </Dialog>
  );
}
