import { Bookmark, BookmarkX, FileVideo, HardDrive, RotateCw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import {
  getJson, postJson, type DeleteChoices, type DeleteMode, type DeletePlan, type DeletePlanDownload, type DeleteRan, type DeletePlanTorrent, type QueueAction,
  type RemovalAdvice,
} from '../library/api';
import { navigate } from '../navigation';
import {
  adviceLine, defaultMode, defaultQueueAction, defaultVersionChoice, deleteActionText, deleteBase, deleteChoices, deleteModes, deletePlanPath, deleteResultRows,
  deleteResultTitle, deleteSubjectText, deleteTitleText, downloadHoldsText, followingUnanswered, modeChoiceText, monitoringLines, torrentHoldsText, versionGroups,
  versionHoldsText, type DeleteTarget, type VersionChoice, type VersionGroup,
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

function QueueChoice({ value, risky, onChange }: { value: QueueAction; risky: boolean; onChange: (value: QueueAction) => void }) {
  return (
    <ToggleGroup value={value} onValueChange={(next) => onChange(next as QueueAction)} aria-label="Download">
      <ToggleGroupItem value="leave">Leave</ToggleGroupItem>
      <ToggleGroupItem value="remove">Remove</ToggleGroupItem>
      <ToggleGroupItem value="removeWithTorrent" risk={risky}>Remove with torrent</ToggleGroupItem>
    </ToggleGroup>
  );
}

function CheckOption({ checked, label, why, onChange }: { checked: boolean; label: string; why: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex w-full gap-2 px-1 py-1 font-ui text-[13px]">
      <Checkbox checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="font-medium text-muted-foreground">{why}</span>
      </span>
    </label>
  );
}

function Section({ label, count, children }: { label: string; count?: number; children: ReactNode }) {
  return (
    <section className="flex w-full flex-col gap-2">
      <LabelGroup count={count} className="p-0">{label}</LabelGroup>
      {children}
    </section>
  );
}

/**
 * Delete a movie, a show, one season or a selection of a show's seasons and episodes: the plan from the server, what happens afterwards and the
 * owner's other choices, then every step's result and what is monitored now.
 * `name` titles the dialog while the plan loads; `codeOf` names an episode id ("S02E04") for second-version and download rows.
 */
export function DeleteTitle({ target: opened, name, codeOf = () => null, onClose, onUnauthenticated }: {
  target: DeleteTarget;
  name: string;
  codeOf?: (episodeId: number) => string | null;
  onClose: () => void;
  onUnauthenticated: () => void;
}) {
  // "Remove the show instead" swaps a selection for the whole show.
  const [current, setCurrent] = useState(opened);
  const base = deleteBase(current);
  const planPath = deletePlanPath(current);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [reload, setReload] = useState(0);
  const [pickedMode, setMode] = useState<DeleteMode | null>(null);
  const [removeTorrents, setRemoveTorrents] = useState<ReadonlySet<string>>(new Set());
  const [picks, setPicks] = useState<ReadonlyMap<string, VersionChoice>>(new Map());
  const [exclude, setExclude] = useState(false);
  const [blocklist, setBlocklist] = useState(true);
  const [keepFollowing, setKeepFollowing] = useState<ReadonlyMap<number, boolean>>(new Map());
  const [queuePicks, setQueuePicks] = useState<ReadonlyMap<string, QueueAction>>(new Map());
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getJson<DeletePlan>(planPath, onUnauthenticated, controller.signal)
      .then((plan) => {
        // A fresh plan starts from its own defaults: the target's default mode, torrents kept, second versions and downloads as that mode
        // suggests, the import list left alone, the release blocklisted when searching again, and no airing season answered.
        setMode(null);
        setRemoveTorrents(new Set());
        setPicks(new Map());
        setExclude(false);
        setBlocklist(true);
        setKeepFollowing(new Map());
        setQueuePicks(new Map());
        setLoad({ kind: 'ready', plan });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoad({ kind: 'failed', message: error instanceof Error ? error.message : 'The request failed.' });
      });
    return () => controller.abort();
  }, [planPath, reload]);

  const service = current.kind === 'movie' ? 'radarr' : 'sonarr';
  const close = () => {
    onClose();
    // Only a removed title leaves its page with nothing to show; an older server's show delete always removes.
    const removed = done?.choices.mode === 'remove' || (done?.choices.mode === undefined && current.kind === 'series');
    if (done?.ran.deleted && removed) navigate('/');
  };

  if (done !== null) {
    const rows = deleteResultRows(done.plan, done.choices, done.ran, tracker);
    const read = done.ran.steps.find((step) => step.step === 'monitoring' && step.outcome !== 'failed');
    const lines = read?.step === 'monitoring' ? monitoringLines(read.monitoring) : [];
    return (
      <Dialog
        open
        onOpenChange={(next) => { if (!next) close(); }}
        title={deleteResultTitle(current, done.plan, done.ran.deleted)}
        subject={done.ran.deleted
          ? 'Every step, in the order it ran. This also appears under Deletions in the activity log.'
          : 'Every step, in the order it ran. Nothing after the failed step ran.'}
        scrollEdges
        actions={<Button size="large" onClick={close}>Done</Button>}
      >
        <div className="flex w-full flex-col">
          {rows.map((row, index) => <RowDeleteStep key={index} look={row.look} text={row.text} why={row.why} />)}
        </div>
        {lines.length > 0 && (
          <Section label={`Monitoring now, read back from ${service === 'radarr' ? 'Radarr' : 'Sonarr'}`}>
            <ul className="m-0 flex list-none flex-col gap-2 p-0 font-ui text-[13px] font-medium text-foreground">
              {lines.map((line) => (
                <li key={line} className="flex items-center gap-2"><Bookmark aria-hidden="true" className="size-3.5 shrink-0" />{line}</li>
              ))}
            </ul>
          </Section>
        )}
      </Dialog>
    );
  }

  if (load.kind !== 'ready') {
    return (
      <Dialog
        open
        onOpenChange={(next) => { if (!next) onClose(); }}
        title={deleteTitleText(current, { service, title: name })}
        scrollEdges
        footerCallout={load.kind === 'failed' ? (
          <Callout
            title="Couldn't check what this delete would touch."
            action={(
              <Button
                variant="outline"
                icon={<RotateCw />}
                onClick={() => {
                  setLoad({ kind: 'loading' });
                  setReload((count) => count + 1);
                }}
              >
                Try again
              </Button>
            )}
          >
            {load.message}
          </Callout>
        ) : undefined}
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
  const target = current;
  const modes = deleteModes(target, plan);
  const mode = pickedMode !== null && modes.includes(pickedMode) ? pickedMode : defaultMode(modes);
  const groups = versionGroups(plan);
  const choices = deleteChoices(target, mode, removeTorrents, groups, picks, { plan, excludeFromImportLists: exclude, blocklistCurrent: blocklist, keepFollowing, queue: queuePicks });
  const unanswered = followingUnanswered(plan, keepFollowing);
  const airing = plan.monitoring?.airingSeasons ?? [];
  const queue = plan.queue ?? [];
  const library = plan.torrents.filter((torrent) => !torrent.upgradedAway);
  const earlier = plan.torrents.filter((torrent) => torrent.upgradedAway);
  const unlinked = plan.files.filter((file) => file.note !== null);
  const pick = (group: VersionGroup) => picks.get(group.key) ?? defaultVersionChoice(mode);
  const setPick = (group: VersionGroup, next: Partial<VersionChoice>) => setPicks(new Map(picks).set(group.key, { ...pick(group), ...next }));
  const setRemove = (hash: string, remove: boolean) => {
    const next = new Set(removeTorrents);
    if (remove) next.add(hash);
    else next.delete(hash);
    setRemoveTorrents(next);
  };

  // Held until the reply is fully read, so a second press cannot send another delete.
  const confirm = async () => {
    if (inFlight.current || unanswered) return;
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
    setNotice(null);
    const response = await postJson(`${base}/delete`, choices).catch(() => null);
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
        advice={advice(torrent.advice, torrent.advice.ruleHours)}
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

  const downloadRow = (download: DeletePlanDownload) => {
    const lead = download.advice === null ? null : logo(download.advice.host);
    return (
      <RowDeleteTorrent
        key={download.downloadId}
        lead={lead}
        marks={lead === null ? 0 : 1}
        name={download.title}
        holds={downloadHoldsText(download, codeOf)}
        advice={download.advice === null ? undefined : advice(download.advice, download.advice.ruleHours)}
        locked={download.removable.allowed ? undefined : download.removable.reason}
        action={(
          <QueueChoice
            value={queuePicks.get(download.downloadId) ?? defaultQueueAction(mode)}
            risky={download.advice !== null && download.advice.recommendation !== 'safe'}
            onChange={(next) => setQueuePicks(new Map(queuePicks).set(download.downloadId, next))}
          />
        )}
      />
    );
  };

  const seriesId = target.kind === 'season' || target.kind === 'selection' ? target.seriesId : target.id;
  const removeShow = () => {
    setLoad({ kind: 'loading' });
    setNotice(null);
    setCurrent({ kind: 'series', id: seriesId });
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => { if (!next && !sending) onClose(); }}
      title={deleteTitleText(target, plan)}
      subject={deleteSubjectText(target, plan, mode, formatBytes)}
      scrollEdges
      footerCallout={notice === null ? undefined : <Callout look={notice.look} title={notice.title}>{notice.body}</Callout>}
      actions={(
        <>
          <Button variant="outline" disabled={sending} onClick={onClose}>Cancel</Button>
          <Button variant="destructive" size="large" loading={sending} disabled={unanswered} onClick={() => void confirm()}>{deleteActionText(target, mode, choices, groups)}</Button>
        </>
      )}
    >
      {plan.monitoring?.leavesShowEmpty === true && mode === 'keepUnmonitored' && target.kind !== 'series' && (
        <Callout look="info" title="This leaves the show with no files and nothing monitored." action={<Button variant="outline" onClick={removeShow}>Remove the show instead</Button>}>
          Sonarr would keep listing it with nothing to do.
        </Callout>
      )}
      {modes.length > 1 && (
        <Section label="Afterwards">
          <RadioGroup value={mode} onValueChange={(value) => setMode(value as DeleteMode)} className="flex flex-col gap-2">
            {modes.map((value) => (
              <div key={value} className="flex flex-col gap-1">
                <CardChoice value={value} {...modeChoiceText(target, plan, value)} />
                {value === 'remove' && mode === 'remove' && plan.importLists === true && (
                  <CheckOption
                    checked={exclude}
                    onChange={setExclude}
                    label="Don't let import lists add it back"
                    why={`${service === 'radarr' ? 'Radarr' : 'Sonarr'} has an import list turned on. Without this, it comes back the next time the list syncs.`}
                  />
                )}
                {value === 'searchAgain' && mode === 'searchAgain' && (
                  <CheckOption
                    checked={blocklist}
                    onChange={setBlocklist}
                    label={target.kind === 'movie' ? "Don't grab this release again" : "Don't grab these releases again"}
                    why={`Adds what is being deleted to ${service === 'radarr' ? 'Radarr' : 'Sonarr'}'s blocklist, so the search finds a different release.`}
                  />
                )}
              </div>
            ))}
          </RadioGroup>
        </Section>
      )}
      {airing.map((season) => {
        const answer = keepFollowing.get(season);
        return (
          <div key={season} className="flex w-full flex-col gap-2.5 rounded-md border border-border bg-card px-3.5 py-3 font-ui text-[13px] font-medium">
            <p className="m-0 font-semibold text-foreground">{`Season ${season} is still airing. Keep following it?`}</p>
            <p className="m-0 text-muted-foreground">{`Sonarr grabs episodes that haven't aired yet only while Season ${season} stays monitored.`}</p>
            <ToggleGroup
              value={answer === undefined ? '' : answer ? 'keep' : 'stop'}
              onValueChange={(next) => setKeepFollowing(new Map(keepFollowing).set(season, next === 'keep'))}
              aria-label={`Season ${season}`}
              className="self-start"
            >
              <ToggleGroupItem value="keep">Keep following new episodes</ToggleGroupItem>
              <ToggleGroupItem value="stop">Stop following</ToggleGroupItem>
            </ToggleGroup>
            {answer === undefined && <p className="m-0 text-muted-foreground">Pick one to delete.</p>}
          </div>
        );
      })}
      {queue.length > 0 && <Section label="Downloads in progress" count={queue.length}>{queue.map(downloadRow)}</Section>}
      {target.kind === 'season' && plan.modes === undefined && (
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
