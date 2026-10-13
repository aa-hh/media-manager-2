import { Download, RefreshCw, SearchX } from 'lucide-react';
import { use, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Callout } from './components/ui/callout';
import { CardChoice } from './components/ui/card-choice';
import { ChipFit } from './components/ui/chip-fit';
import { ChipReleaseState } from './components/ui/chip-release-state';
import { Dialog } from './components/ui/dialog';
import { DialogCountsAs } from './components/ui/dialog-counts-as';
import { SelectContent, SelectItem } from './components/ui/dropdown-menu';
import { EmptyState } from './components/ui/empty-state';
import { LineInsetNotice } from './components/ui/line-inset-notice';
import { RadioGroup } from './components/ui/radio';
import { RowEpisodeReleases } from './components/ui/row-episode-releases';
import { RowRelease, RowReleaseHeader, RowReleaseSkeleton } from './components/ui/row-release';
import { Select, SelectTrigger } from './components/ui/select-trigger';
import { Spinner } from './components/ui/spinner';
import { useToastManager } from './components/ui/toast';
import { ToggleGroup, ToggleGroupItem } from './components/ui/toggle-group';
import type { SubjectProgress } from './library/progress';
import { MediaServerContext } from './mediaServer';
import { fitKindOf, formatSize, formatsOf, historyOf, qualityParts, releaseStateOf, scoresExist, seasonName, splitReleaseName, visibleReleases } from './releaseView';
import { cn } from '@/lib/utils';

export type ReleaseTarget =
  | { service: 'radarr'; kind: 'movie'; movieId: number }
  | { service: 'sonarr'; kind: 'episode'; seriesId: number; episodeId: number }
  | { service: 'sonarr'; kind: 'season'; seriesId: number; seasonNumber: number };

export type OwnedEpisode = {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string | null;
  airDate: string | null;
  monitored: boolean;
  hasFile: boolean;
  /** The title page passes the episode's file, so the season pack choice can name each owned quality. */
  file?: { quality: string | null } | null;
  /** The numbers trackers use, when they differ from Sonarr's; the title page passes them. */
  sceneSeasonNumber?: number | null;
  sceneEpisodeNumber?: number | null;
};

type PastEvent = { kind: 'grabbed' | 'failed' | 'blocklisted'; at: string | null };

type Release = {
  guid: string;
  indexer: string | null;
  title: string;
  quality: string | null;
  size: number | null;
  ageHours: number | null;
  seeders: number | null;
  leechers: number | null;
  approved: boolean;
  rejections: string[];
  customFormatScore: number;
  customFormats: string[];
  flags: string[];
  past: PastEvent[];
  // The episodes Sonarr maps the release to; a season pack lists every one it covers.
  episodeIds?: number[];
  // Whether Sonarr or Radarr matched the release to what was searched; searches stored before they were kept lack them.
  episodeRequested?: boolean;
  movieRequested?: boolean;
  audio?: string | null;
  hdr?: string | null;
  hitAndRun?: (Rule & { cooldown: boolean; cooldownSince: number | null }) | null;
};

type Rule = { host: string; hours: number | null; ratio: number | null; logic: 'and' | 'or' | null };

type Owned = {
  quality: string | null;
  releaseTitle: string | null;
  releaseGroup: string | null;
  size: number;
  customFormatScore: number | null;
  qualityCutoffNotMet: boolean;
  audio: string | null;
  hdr: string | null;
  hitAndRun: (Rule & { seededHours: number; currentRatio: number; met: boolean }) | null;
};

type Stored = { fetchedAt: number; releases: Release[]; owned?: Owned | null };

type ListState =
  | { kind: 'loading' }
  | { kind: 'ready'; stored: Stored; refreshing: boolean; problem?: string }
  | { kind: 'failed'; problem: string };

type GrabOutcome = { guid: string; message: string; outOfDate: boolean };

type Choice = 'replace' | 'second';

const ALL = 'all';

const noReleases: Release[] = [];

const serviceLabel = (target: ReleaseTarget) => (target.service === 'sonarr' ? 'Sonarr' : 'Radarr');

const problemText = (target: ReleaseTarget, error: unknown) => {
  const name = serviceLabel(target);
  if (error === 'not_configured') return `${name} isn't connected yet.`;
  if (error === 'rejected') return `${name} refused the API key.`;
  return `${name} didn't answer the search.`;
};

const targetBody = (target: ReleaseTarget) => Object.fromEntries(Object.entries(target).filter(([key]) => key !== 'service'));
const query = (target: ReleaseTarget) => new URLSearchParams(
  Object.entries(targetBody(target)).map(([key, value]) => [key, String(value)]),
).toString();

const postJson = (path: string, body: unknown) => fetch(path, {
  method: 'POST',
  credentials: 'same-origin',
  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'media-manager-2', Accept: 'application/json' },
  body: JSON.stringify(body),
});

const readBody = async (response: Response): Promise<Record<string, unknown>> => {
  try {
    const value: unknown = await response.json();
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const pad = (number: number) => String(number).padStart(2, '0');

// The table leaves out Age, so the age rides in the hover text after the flags.
const ageText = (hours: number) => (hours < 24 ? `${Math.max(0, Math.floor(hours))} h old` : `${Math.floor(hours / 24)} d old`);

// The name cell cuts the middle, so the hover text leads with the full release name.
const hoverOf = (release: Release) => {
  const notes = [...release.flags, ...(release.ageHours === null ? [] : [ageText(release.ageHours)])];
  return [release.title, notes.join(' · ')].filter((part) => part !== '').join('\n');
};

const otherWords = { episode: ['another episode', 'other episodes'], season: ['another season', 'other seasons'], movie: ['another movie', 'other movies'] } as const;

export function PickRelease({ target, name, episodes, movieHasFile, variant, live, onClose, onUnauthenticated }: {
  target: ReleaseTarget;
  /** The series or movie name, which leads the grab dialog's description when given. */
  name?: string;
  episodes: OwnedEpisode[];
  movieHasFile: boolean;
  /** Episode: the inset starts at the title column; movie: at 16, for the movie page, a season and Flagged. */
  variant: 'episode' | 'movie';
  /** The subject's live download, which a grabbed release's chip follows. */
  live?: SubjectProgress;
  onClose: () => void;
  onUnauthenticated: () => void;
}) {
  const serverLabel = use(MediaServerContext).name === 'jellyfin' ? 'Jellyfin' : 'Plex';
  const [list, setList] = useState<ListState>({ kind: 'loading' });
  // The release whose grab is being decided or sent.
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const [panel, setPanel] = useState<'decision' | undefined>(undefined);
  const [choice, setChoice] = useState<Choice>('replace');
  // Which episode the release is grabbed as; it starts at the searched one each time the dialog opens.
  const [countsAs, setCountsAs] = useState<{ open: boolean; episodeId: number | undefined }>({ open: false, episodeId: undefined });
  const [qualityFilter, setQualityFilter] = useState<string>(ALL);
  const [grabbing, setGrabbing] = useState(false);
  // State lags a render behind, so two fast sends could both read grabbing as false; the ref is set before the first await.
  const inFlight = useRef(false);
  const [grabbed, setGrabbed] = useState<Set<string>>(() => new Set());
  const [outcome, setOutcome] = useState<GrabOutcome | undefined>(undefined);
  // Goes up when a search answers in place of the placeholders, so the rows fade in once.
  const [arrival, setArrival] = useState(0);
  const toasts = useToastManager();
  const targetQuery = query(target);
  // Callers may build a new target object on every render; searching again needs a different service or target.
  const searchedTarget = useMemo(() => target, [target.service, targetQuery]);
  const service = serviceLabel(target);

  const load = useCallback(async (refresh: boolean) => {
    setList((current) => (current.kind === 'ready' ? { ...current, refreshing: true, problem: undefined } : { kind: 'loading' }));
    setOutcome(undefined);
    try {
      const response = refresh
        ? await postJson('/api/releases/refresh', targetBody(searchedTarget))
        : await fetch(`/api/releases?${targetQuery}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (response.status === 401) {
        onUnauthenticated();
        return;
      }
      const body = await readBody(response);
      if (!refresh) setArrival((count) => count + 1);
      if (response.ok) {
        setList({ kind: 'ready', stored: body as unknown as Stored, refreshing: false });
        return;
      }
      const stored = body.stored as Stored | null | undefined;
      const problem = problemText(searchedTarget, body.error);
      setList(stored ? { kind: 'ready', stored, refreshing: false, problem } : { kind: 'failed', problem });
    } catch {
      setList((current) => (current.kind === 'ready'
        ? { ...current, refreshing: false, problem: "The search didn't reach media-manager-2's server." }
        : { kind: 'failed', problem: "The search didn't reach media-manager-2's server." }));
    }
  }, [targetQuery, searchedTarget, onUnauthenticated]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const releases = list.kind === 'ready' ? list.stored.releases : noReleases;
  const owned = list.kind === 'ready' ? list.stored.owned ?? null : null;
  const { shown, hidden } = visibleReleases(searchedTarget, releases, episodes);
  // Sonarr and Radarr return releases in their own preference order, so the first listed one that
  // passes the profile is the one they would grab themselves.
  const best = shown.find((release) => release.approved)?.guid;
  const scores = scoresExist(shown);
  // The filter groups by resolution; a release with no quality counts only under All.
  const resolutionOf = (release: Release) => (release.quality === null ? undefined : qualityParts(release.quality).resolution);
  const qualityCounts = new Map<string, number>();
  for (const release of shown) {
    const resolution = resolutionOf(release);
    if (resolution !== undefined) qualityCounts.set(resolution, (qualityCounts.get(resolution) ?? 0) + 1);
  }
  // Highest resolution first; a key with no number (sort is stable) keeps its first-seen place after them.
  const resolutionNumber = (key: string) => Number(/\d+/.exec(key)?.[0] ?? -1);
  const qualityChips = [...qualityCounts].sort(([a], [b]) => resolutionNumber(b) - resolutionNumber(a));
  // A quality a refresh no longer returns falls back to All, so the list never shows a header with no rows.
  const filterInForce = qualityCounts.has(qualityFilter) ? qualityFilter : ALL;
  const visible = filterInForce === ALL ? shown : shown.filter((release) => resolutionOf(release) === filterInForce);

  const grabTargetHasFile = (given: { episodeIds?: number[] }) => (target.kind === 'movie'
    ? movieHasFile
    : given.episodeIds !== undefined
      ? episodes.some((episode) => given.episodeIds!.includes(episode.id) && episode.hasFile)
      : target.kind === 'episode'
        ? episodes.some((episode) => episode.id === target.episodeId && episode.hasFile)
        : episodes.some((episode) => episode.seasonNumber === target.seasonNumber && episode.hasFile));

  // episodeIds only when Counts as names another episode; never a quality.
  const sendGrab = async (guid: string, intent: 'grab' | 'replace', episodeIds?: number[]) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setGrabbing(true);
    setOutcome(undefined);
    try {
      const response = await postJson('/api/grabs', {
        target: targetBody(target),
        guid,
        intent,
        ...(episodeIds === undefined || target.service !== 'sonarr' ? {} : { overrides: { seriesId: target.seriesId, episodeIds } }),
      });
      if (response.status === 401) {
        onUnauthenticated();
        return;
      }
      const body = await readBody(response);
      if (response.status === 201) {
        setGrabbed((current) => new Set(current).add(guid));
        // A grab kept as sent in doubt (the service never answered) carries that doubt in failure; it beats the replace note.
        const grab = body.grab as { failure?: unknown } | undefined;
        const doubt = typeof grab?.failure === 'string' ? grab.failure : undefined;
        toasts.add({
          title: `Sent to ${service}.`,
          description: doubt ?? (intent === 'replace' ? 'media-manager-2 will finish the replace when the download completes.' : undefined),
        });
        setPanel(undefined);
      } else {
        setOutcome({
          guid,
          outOfDate: typeof body.reason !== 'string' && body.error === 'unknown_release',
          message: typeof body.reason === 'string' ? `${service} refused the grab: ${body.reason}`
            : body.error === 'unknown_release' ? 'These results are out of date. Refresh and pick again.'
              : `${service} didn't take the grab.`,
        });
      }
    } catch {
      setOutcome({ guid, outOfDate: false, message: "The grab didn't reach media-manager-2's server." });
    } finally {
      inFlight.current = false;
      setGrabbing(false);
    }
  };

  // A second version goes from media-manager-2 to rTorrent directly; Sonarr and Radarr never see it.
  const sendSecondVersion = async (guid: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setGrabbing(true);
    setOutcome(undefined);
    try {
      const response = await postJson('/api/second-versions', { target: targetBody(target), guid });
      if (response.status === 401) {
        onUnauthenticated();
        return;
      }
      const body = await readBody(response);
      // 202: rTorrent may have the torrent even though the send failed; the next check settles it and it is never sent twice.
      if (response.status === 201 || response.status === 202) {
        setPanel(undefined);
        setGrabbed((current) => new Set(current).add(guid));
        toasts.add({
          title: 'Sent to rTorrent as a second version.',
          description: response.status === 202 && typeof body.reason === 'string'
            ? `rTorrent didn't confirm it yet: ${body.reason}`
            : undefined,
        });
      } else {
        setOutcome({
          guid,
          outOfDate: body.error === 'unknown_release',
          message: typeof body.reason === 'string' ? `The second version wasn't sent. ${body.reason}`
            : body.error === 'unknown_release' ? 'These results are out of date. Refresh and pick again.'
              : "The second version didn't reach rTorrent.",
        });
      }
    } catch {
      setOutcome({ guid, outOfDate: false, message: "The grab didn't reach media-manager-2's server." });
    } finally {
      inFlight.current = false;
      setGrabbing(false);
    }
  };

  // Reached while a grab is in flight or done, and the server records and sends every grab it gets. A tracker cooldown
  // refuses every grab from it, so its rows have no Grab at all.
  const onGrab = (guid: string) => {
    if (grabbing || inFlight.current || grabbed.has(guid)) return;
    if (releases.find((release) => release.guid === guid)?.hitAndRun?.cooldown === true) return;
    setPicked(guid);
    if (grabTargetHasFile({})) {
      setChoice('replace');
      setCountsAs({ open: false, episodeId: target.kind === 'episode' ? target.episodeId : undefined });
      setPanel('decision');
    } else void sendGrab(guid, 'grab');
  };

  const overridden = target.kind === 'episode' && countsAs.episodeId !== undefined && countsAs.episodeId !== target.episodeId;
  const chosenIds = target.kind === 'episode' && countsAs.episodeId !== undefined ? [countsAs.episodeId] : undefined;
  // Counts as can name an episode with no file, and then there is nothing to replace or keep a second version beside.
  const replacing = grabTargetHasFile({ episodeIds: chosenIds });
  const confirm = () => {
    if (picked === undefined || grabbing || inFlight.current) return;
    // The second-version route takes no overrides, so an overridden release can only replace.
    if (replacing && choice === 'second' && !overridden) {
      void sendSecondVersion(picked);
      return;
    }
    void sendGrab(picked, replacing ? 'replace' : 'grab', overridden ? chosenIds : undefined);
  };

  // The dialog's keys reach here through its portal. 1 and 2 pick, except while the grab is in flight; Enter grabs wherever
  // focus sits except on Cancel or Close (both carry data-cancel) and inside Counts as or its episode list, where Enter
  // opens it or picks an episode. It is caught before the focused element can act on it.
  const onDecisionKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (panel !== 'decision') return;
    if (event.key === '1' && replacing && !grabbing) setChoice('replace');
    if (event.key === '2' && replacing && !overridden && !grabbing) setChoice('second');
    if (event.key === 'Enter' && (event.target as HTMLElement).closest('[data-cancel], [data-counts-as], [role="listbox"]') === null) {
      event.preventDefault();
      event.stopPropagation();
      confirm();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (panel === undefined && event.key === 'Escape') onClose();
  };

  const refreshing = list.kind === 'ready' && list.refreshing;
  const refreshButton = (
    <Button variant="outline" size="row" icon={<RefreshCw />} loading={list.kind === 'loading' || refreshing} disabled={list.kind !== 'ready'} onClick={() => void load(true)}>
      Refresh
    </Button>
  );

  // What the grab decision describes: the owned file for one episode or movie, the pack and its episodes for a season.
  const chosen = releases.find((release) => release.guid === picked);
  // The subject line names the group as a word, without the dash the name cell keeps.
  const chosenGroup = chosen === undefined ? undefined : splitReleaseName(chosen.title, target.kind).group?.slice(1);
  const secondAllowed = !overridden;
  const packEpisodes = target.kind !== 'season' ? [] : episodes
    .filter((episode) => (chosen?.episodeIds !== undefined && chosen.episodeIds.length > 0
      ? chosen.episodeIds.includes(episode.id)
      : episode.seasonNumber === target.seasonNumber))
    .sort((a, b) => a.episodeNumber - b.episodeNumber);
  const missing = packEpisodes.filter((episode) => !episode.hasFile).map((episode) => `E${pad(episode.episodeNumber)}`);
  const packNote = [
    `All ${packEpisodes.length} share one torrent, which stays while any of these second versions remains.`,
    missing.length === 0 ? undefined : missing.length === 1
      ? `${missing[0]} has no file yet: it gets a second version only, and Sonarr still lists it as missing.`
      : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]} have no file yet: they get a second version only, and Sonarr still lists them as missing.`,
  ].filter((part) => part !== undefined).join(' ');
  const targetEpisode = target.kind === 'episode' ? episodes.find((episode) => episode.id === target.episodeId) : undefined;
  const lead = name === undefined ? undefined
    : target.kind === 'season' ? `${name} S${pad(target.seasonNumber)}`
      : targetEpisode === undefined ? name : `${name} S${pad(targetEpisode.seasonNumber)}E${pad(targetEpisode.episodeNumber)}`;
  const incoming = chosen === undefined ? ''
    : `${[chosen.quality, chosenGroup, formatSize(chosen.size)].filter((part) => part != null && part !== '').join(' · ')}${chosen.indexer === null ? '' : ` from ${chosen.indexer}`}`;
  const decisionSubject = target.kind === 'season'
    ? `${lead === undefined ? '' : `${lead} · `}${[chosen?.quality, chosenGroup, chosen === undefined ? undefined : formatSize(chosen.size)].filter((part) => part != null && part !== '').join(' · ')}, one torrent with ${packEpisodes.length} episodes. You have files for ${packEpisodes.length - missing.length} of them; their torrents keep seeding either way.`
    : `${incoming === '' ? '' : `Grabbing ${incoming}. `}${owned === null ? (lead === undefined ? '' : `${lead}. `) : `${lead === undefined ? 'Your' : `${lead} · your`} ${[owned.quality, owned.releaseGroup, formatSize(owned.size)].filter((part) => part != null && part !== '').join(' · ')}. `}The current file's torrent keeps seeding either way.`;
  const second = replacing && choice === 'second' && secondAllowed;
  const confirmLabel = grabbing
    ? (second || !replacing ? 'Grabbing…' : 'Replacing…')
    : !replacing ? 'Grab'
      : second
        ? (target.kind === 'season' ? `Grab ${packEpisodes.length} second versions` : 'Grab as second version')
        : (target.kind === 'season' ? 'Grab and replace the current files' : 'Grab and replace the current file');

  // Trackers that number this episode differently from Sonarr search under their own numbers.
  const sceneCode = targetEpisode?.sceneSeasonNumber != null && targetEpisode.sceneEpisodeNumber != null
    && (targetEpisode.sceneSeasonNumber !== targetEpisode.seasonNumber || targetEpisode.sceneEpisodeNumber !== targetEpisode.episodeNumber)
    ? `S${pad(targetEpisode.sceneSeasonNumber)}E${pad(targetEpisode.sceneEpisodeNumber)}`
    : undefined;
  const notices = list.kind === 'failed'
    ? (
      <LineInsetNotice role="alert" action={<Button variant="outline" size="row" icon={<RefreshCw />} onClick={() => void load(false)}>Try again</Button>}>
        {list.problem}
      </LineInsetNotice>
    )
    : (
      <>
        {sceneCode !== undefined && <LineInsetNotice>{`Trackers number this episode ${sceneCode}.`}</LineInsetNotice>}
        {list.kind === 'ready' && list.problem !== undefined && (
          <LineInsetNotice role="alert" action={refreshButton}>{`${list.problem} These are the earlier results.`}</LineInsetNotice>
        )}
        {outcome?.outOfDate === true && <LineInsetNotice role="alert" action={refreshButton}>{outcome.message}</LineInsetNotice>}
        {/* A grab sent straight from a row has no dialog to show a refusal in. */}
        {outcome !== undefined && !outcome.outOfDate && panel !== 'decision' && <LineInsetNotice role="alert">{outcome.message}</LineInsetNotice>}
      </>
    );

  const empty = list.kind === 'ready' && shown.length === 0;
  const filter = list.kind === 'loading'
    ? (
      <>
        {refreshButton}
        <span aria-live="polite" className="font-ui text-[13px] text-muted-foreground">Searching every indexer. This takes about 20 seconds.</span>
      </>
    )
    : list.kind === 'ready' && !empty
      ? (
        <>
          {qualityCounts.size > 0 && (
            <ToggleGroup size="inset" aria-label="Quality" value={filterInForce} onValueChange={setQualityFilter} className={cn(refreshing && 'opacity-40')}>
              <ToggleGroupItem value={ALL} count={shown.length}>All</ToggleGroupItem>
              {qualityChips.map(([quality, count]) => (
                <ToggleGroupItem key={quality} value={quality} count={count}>{quality}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          {refreshButton}
        </>
      )
      : undefined;

  const others = otherWords[target.kind];
  const ownedFit = owned === null || !scores || owned.customFormatScore === null
    ? undefined
    : fitKindOf({ approved: true, customFormatScore: owned.customFormatScore }, false, true);

  const countsAsEpisode = episodes.find((episode) => episode.id === countsAs.episodeId);
  const episodeLabel = (episode: OwnedEpisode) => `E${pad(episode.episodeNumber)} ${episode.title ?? ''}`.trim();

  return (
    <div role="table" aria-label="Releases" onKeyDown={onKeyDown} onKeyDownCapture={onDecisionKeyDown}>
      <RowEpisodeReleases
        variant={variant}
        notices={notices}
        filter={filter}
        header={list.kind === 'failed' ? undefined : <RowReleaseHeader />}
        pinned={owned === null ? undefined : (
          <RowRelease
            yours
            name={splitReleaseName((owned.releaseTitle ?? '').replace(/\.(mkv|mp4|m4v|avi|ts)$/i, ''), target.kind)}
            formats={formatsOf(owned.audio, owned.hdr)}
            tracker={owned.hitAndRun?.host ?? ''}
            fit={ownedFit === undefined ? undefined : <ChipFit kind={ownedFit.kind}>{ownedFit.text}</ChipFit>}
            quality={qualityParts(owned.quality)}
            size={formatSize(owned.size)}
            action={<ChipReleaseState state="yours" />}
          />
        )}
        searching={list.kind === 'loading'}
        arrivalKey={arrival}
        empty={empty
          ? (
            <EmptyState
              icon={<SearchX />}
              title={`No release for this ${target.kind}`}
              action={<Button variant="outline" icon={<RefreshCw />} loading={refreshing} onClick={() => void load(true)}>Search again</Button>}
            >
              {hidden.length === 0 ? undefined
                : hidden.length === 1 ? `1 result was for ${others[0]}` : `${hidden.length} results were for ${others[1]}`}
            </EmptyState>
          )
          : undefined}
      >
        {list.kind === 'loading' && Array.from({ length: 4 }, (_, index) => <RowReleaseSkeleton key={index} index={index} />)}
        {list.kind === 'ready' && visible.map((release) => {
          const isBest = release.guid === best;
          const cooling = release.hitAndRun?.cooldown === true;
          const fit = fitKindOf(release, isBest, scores);
          const proper = /\b(proper|repack)\b/i.exec(release.title)?.[1];
          return (
            <RowRelease
              key={release.guid}
              title={hoverOf(release)}
              best={isBest}
              rejected={!release.approved}
              cooldown={cooling}
              name={splitReleaseName(release.title, target.kind)}
              history={historyOf(release.past)}
              formats={formatsOf(release.audio, release.hdr)}
              seeders={release.seeders}
              leechers={release.leechers}
              tracker={release.indexer ?? ''}
              freeleech={release.flags.find((flag) => flag.startsWith('Freeleech'))}
              fit={fit === undefined ? undefined : (
                <ChipFit kind={fit.kind} tooltip={fit.kind === 'rejected' && release.rejections.length > 0 ? release.rejections.join(' · ') : undefined}>
                  {fit.text}
                </ChipFit>
              )}
              quality={qualityParts(release.quality)}
              proper={proper === undefined ? undefined : proper.toLowerCase() === 'proper' ? 'Proper' : 'Repack'}
              size={formatSize(release.size)}
              action={cooling ? <ChipReleaseState state="cooldown" />
                : grabbed.has(release.guid) ? <ChipReleaseState {...releaseStateOf(live)} />
                  : (
                    <Button
                      size="row"
                      variant={release.approved ? 'default' : 'outline'}
                      icon={<Download />}
                      loading={grabbing && picked === release.guid}
                      onClick={() => onGrab(release.guid)}
                    >
                      Grab
                    </Button>
                  )}
            />
          );
        })}
      </RowEpisodeReleases>

      <Dialog
        open={panel === 'decision'}
        onOpenChange={(open) => { if (!open) setPanel(undefined); }}
        title={target.kind === 'season'
          ? `${seasonName(target.seasonNumber)} ${target.seasonNumber === 0 ? 'are' : 'is'} already in your library`
          : 'This is already in your library'}
        subject={decisionSubject}
        escOnCancel
        footerCallout={outcome === undefined || outcome.guid !== picked ? undefined : <Callout look={outcome.outOfDate ? 'warning' : 'risk'} title={outcome.message} />}
        actions={(
          <>
            <Button variant="outline" kbd="Esc" data-cancel="" onClick={() => setPanel(undefined)}>Cancel</Button>
            <Button
              size="large"
              kbd="↵"
              icon={grabbing ? <Spinner className="text-current" /> : undefined}
              loading={grabbing}
              disabled={picked === undefined}
              onClick={confirm}
            >
              {confirmLabel}
            </Button>
          </>
        )}
      >
        {replacing && (
          <RadioGroup
            value={secondAllowed ? choice : 'replace'}
            onValueChange={(value) => setChoice(value as Choice)}
            disabled={grabbing}
            aria-label="Replace or keep as a second version"
            className="flex flex-col gap-2"
          >
            <CardChoice
              value="replace"
              kbd="1"
              title={target.kind === 'season' ? 'Replace tracked versions' : 'Replace tracked version'}
              description={target.kind === 'season'
                ? `The pack becomes the tracked file for all ${packEpisodes.length} episodes, even at lower quality, and is kept from automatic upgrades.`
                : 'The new release becomes the tracked file, even at lower quality, and is kept from automatic upgrades.'}
            />
            <CardChoice
              value="second"
              kbd={secondAllowed ? '2' : undefined}
              disabled={!secondAllowed}
              title={target.kind === 'season' ? 'Keep as second versions' : 'Keep as second version'}
              description={`${target.kind === 'season' ? `Adds a second version to each episode below, side by side in ${serverLabel}.` : `Keeps both files side by side in ${serverLabel}.`}${secondAllowed ? '' : ' Not available while this release is overridden.'}`}
            />
          </RadioGroup>
        )}
        {target.service === 'sonarr' && target.kind === 'episode' && episodes.length > 0 && targetEpisode !== undefined && countsAsEpisode !== undefined && (
          <DialogCountsAs
            open={countsAs.open}
            onOpenChange={(open) => setCountsAs((current) => ({ ...current, open }))}
            summary={`${seasonName(countsAsEpisode.seasonNumber)} · ${episodeLabel(countsAsEpisode)}`}
            season={seasonName(targetEpisode.seasonNumber)}
            select={(
              <Select value={String(countsAsEpisode.id)} onValueChange={(next) => setCountsAs((current) => ({ ...current, episodeId: Number(next) }))}>
                <SelectTrigger variant="inline" size="sm" aria-label="Episode">{episodeLabel(countsAsEpisode)}</SelectTrigger>
                <SelectContent>
                  {episodes
                    .filter((episode) => episode.seasonNumber === targetEpisode.seasonNumber)
                    .sort((a, b) => a.episodeNumber - b.episodeNumber)
                    .map((episode) => <SelectItem key={episode.id} value={String(episode.id)}>{episodeLabel(episode)}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            help="The season comes from the release name. Pick the episode Sonarr files it as."
          />
        )}
        {target.kind === 'season' && packEpisodes.length > 0 && (
          <div className="flex flex-col gap-2 pt-3">
            <span className="flex items-center gap-1.5 font-ui text-sm font-semibold text-foreground">
              Episodes in this release
              <span className="font-data text-[13px] font-normal text-subtle-foreground">{packEpisodes.length}</span>
            </span>
            <div className="flex flex-col rounded-md border border-border">
              {packEpisodes.map((episode) => (
                <div key={episode.id} className="flex h-7 items-center gap-2 border-b border-border px-3 last:border-b-0">
                  <span className="w-6 shrink-0 font-data text-[13px] font-medium text-muted-foreground">E{pad(episode.episodeNumber)}</span>
                  <span className="min-w-0 flex-1 truncate font-ui text-[13px] text-foreground">{episode.title ?? ''}</span>
                  {episode.hasFile
                    ? <Badge>{episode.file?.quality == null ? 'yours' : `yours: ${episode.file.quality}`}</Badge>
                    : <Badge variant="warning">no file yet</Badge>}
                </div>
              ))}
            </div>
            {choice === 'second' && secondAllowed && <p className="font-ui text-xs leading-normal text-muted-foreground">{packNote}</p>}
          </div>
        )}
      </Dialog>
    </div>
  );
}
