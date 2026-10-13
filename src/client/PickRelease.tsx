import { ArrowDown, ArrowUp, RefreshCw, SearchX, SlidersHorizontal } from 'lucide-react';
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { CardChoice } from './components/ui/card-choice';
import { CellProfileFit, type ProfileFit } from './components/ui/cell-profile-fit';
import { Checkbox } from './components/ui/checkbox';
import { Callout } from './components/ui/callout';
import { Dialog } from './components/ui/dialog';
import { SelectContent, SelectItem } from './components/ui/dropdown-menu';
import { EmptyState } from './components/ui/empty-state';
import { FieldLabelled } from './components/ui/field-labelled';
import { Kbd } from './components/ui/kbd';
import { MarkComparison, type Comparison } from './components/ui/mark-comparison';
import { OptionRow } from './components/ui/option-row';
import { PanelInline } from './components/ui/panel-inline';
import { RadioGroup } from './components/ui/radio';
import { RowRelease, RowReleaseHeader } from './components/ui/row-release';
import { Select, SelectTrigger } from './components/ui/select-trigger';
import { SkeletonRow } from './components/ui/skeleton';
import { Spinner } from './components/ui/spinner';
import { StatusInline } from './components/ui/status-inline';
import { useToastManager } from './components/ui/toast';
import { ToggleGroup, ToggleGroupItem } from './components/ui/toggle-group';
import { Tooltip } from './components/ui/tooltip';
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
  flags: string[];
  past: PastEvent[];
  // The episodes Sonarr maps the release to; a season pack lists every one it covers.
  episodeIds?: number[];
  // Worked out by the server on every read; absent from replies of servers that predate them.
  compared?: Comparison | null;
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

type Quality = { id: number; name: string };

type Overrides = { episodeIds?: number[]; qualityId?: number };

type GrabOutcome = { guid: string; message: string; outOfDate: boolean };

type Choice = 'replace' | 'second';

const ALL = 'all';

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

const formatSize = (bytes: number | null) => {
  if (bytes === null) return '';
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  return `${Math.round(bytes / 1e6)} MB`;
};

const formatAge = (hours: number | null) => {
  if (hours === null) return '–';
  return hours < 24 ? `${Math.max(0, Math.floor(hours))} h` : `${Math.floor(hours / 24)} d`;
};

const formatSince = (fetchedAt: number, now: number) => {
  const minutes = Math.floor((now - fetchedAt) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.floor(hours / 24)} days ago`;
};

const pastText = (event: PastEvent) => {
  const when = event.at === null ? '' : ` on ${new Date(event.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
  return event.kind === 'grabbed' ? `Grabbed before${when}` : event.kind === 'failed' ? `Failed before${when}` : `Blocklisted${when}`;
};

// Risks are what could make this grab go wrong, always spelled out rather than coloured alone: the first in the
// fit cell, the rest behind a "+N" that opens on hover or keyboard focus.
const risksOf = (release: Release) => [
  ...release.rejections,
  ...(release.seeders === 0 ? ['0 seeders'] : []),
  ...(release.flags.includes('Nuked') ? ['Nuked'] : []),
  ...release.past.filter((event) => event.kind !== 'grabbed').map(pastText),
];

// How the release fits the profile, in words: the first risk, or the custom format score.
const fitOf = (release: Release, risks: string[]): { fit: ProfileFit; text: string } => {
  if (!release.approved) return { fit: 'rejected', text: risks[0] ?? 'Rejected' };
  if (risks.length > 0) return { fit: 'warning', text: risks[0] };
  return { fit: 'meets', text: `${release.customFormatScore > 0 ? '+' : ''}${release.customFormatScore}` };
};

// Ratios keep a decimal place, so "1.0" reads as a ratio, without rounding away a finer one such as 0.95.
const formatRatio = (ratio: number) => (Number.isInteger(ratio * 10) ? ratio.toFixed(1) : String(ratio));

// The tracker's rule in words, such as "120 h or ratio 1.0"; Blutopia's has hours only.
const ruleText = (rule: Rule) => [
  rule.hours === null ? undefined : `${rule.hours} h`,
  rule.ratio === null ? undefined : `ratio ${formatRatio(rule.ratio)}`,
].filter((part) => part !== undefined).join(rule.logic === 'and' ? ' and ' : ' or ') || '–';

// The owned file's progress against its tracker's rule, such as "seeded 31 h of 120 h".
const seededText = (rule: NonNullable<Owned['hitAndRun']>) => {
  if (rule.hours !== null) return `seeded ${rule.seededHours} h of ${rule.hours} h`;
  if (rule.ratio !== null) return `ratio ${formatRatio(rule.currentRatio)} of ${formatRatio(rule.ratio)}`;
  return '–';
};

// No HDR shows the audio alone.
const audioHdrText = (item: { audio?: string | null; hdr?: string | null }) => (
  [item.audio, item.hdr].filter((part) => part != null && part !== '').join(' · ') || '–'
);

const seasonName = (number: number) => (number === 0 ? 'Specials' : `Season ${number}`);

// The release group is the part after the last dash; the rest is the dotted name.
const splitName = (title: string) => {
  const dash = title.lastIndexOf('-');
  return dash <= 0 || dash === title.length - 1 ? { name: title, group: undefined } : { name: title.slice(0, dash + 1), group: title.slice(dash + 1) };
};

function OverridePanel({ target, episodes, qualities, value, onApply, onCancel }: {
  target: ReleaseTarget;
  episodes: OwnedEpisode[];
  qualities: Quality[] | undefined;
  value: Overrides;
  onApply: (overrides: Overrides) => void;
  onCancel: () => void;
}) {
  const [episodeIds, setEpisodeIds] = useState<number[]>(value.episodeIds ?? (target.kind === 'episode' ? [target.episodeId] : []));
  const [qualityId, setQualityId] = useState<number | undefined>(value.qualityId);
  const seasonNumber = target.kind === 'episode'
    ? episodes.find((episode) => episode.id === target.episodeId)?.seasonNumber
    : target.kind === 'season' ? target.seasonNumber : undefined;
  const [season, setSeason] = useState<number | undefined>(seasonNumber);
  const seasons = [...new Set(episodes.map((episode) => episode.seasonNumber))];
  const seasonName = (number: number | undefined) => (number === undefined ? 'Season' : number === 0 ? 'Specials' : `Season ${number}`);
  const pickEpisodes = target.service === 'sonarr' && episodes.length > 0;
  return (
    <PanelInline
      open
      title="What this release counts as"
      onClose={onCancel}
      closeLabel="Cancel"
      primary={(
        <Button
          disabled={pickEpisodes && episodeIds.length === 0}
          onClick={() => onApply({
            ...(pickEpisodes ? { episodeIds } : {}),
            ...(qualityId === undefined ? {} : { qualityId }),
          })}
        >
          Use this
        </Button>
      )}
      secondary={<Button variant="outline" onClick={onCancel}>Cancel</Button>}
    >
      <div className="flex gap-8 px-5">
        {pickEpisodes && (
          <FieldLabelled label="Episodes" className="w-70">
            <div className="flex flex-col gap-2">
              <Select value={season === undefined ? '' : String(season)} onValueChange={(next) => setSeason(Number(next))}>
                <SelectTrigger aria-label="Season" className="w-40">{seasonName(season)}</SelectTrigger>
                <SelectContent>
                  {seasons.map((number) => <SelectItem key={number} value={String(number)}>{seasonName(number)}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex max-h-48 flex-col overflow-y-auto">
                {episodes.filter((episode) => episode.seasonNumber === season).map((episode) => (
                  <OptionRow
                    key={episode.id}
                    control={(
                      <Checkbox
                        checked={episodeIds.includes(episode.id)}
                        onCheckedChange={(checked) => setEpisodeIds(checked
                          ? [...episodeIds, episode.id]
                          : episodeIds.filter((id) => id !== episode.id))}
                      />
                    )}
                    title={`${String(episode.episodeNumber).padStart(2, '0')}  ${episode.title ?? ''}`}
                  />
                ))}
              </div>
            </div>
          </FieldLabelled>
        )}
        <FieldLabelled label="Quality" className="w-48">
          <Select
            value={qualityId === undefined ? '' : String(qualityId)}
            onValueChange={(next) => setQualityId(next === '' ? undefined : Number(next))}
            disabled={qualities === undefined}
          >
            <SelectTrigger className="w-48">{qualities?.find((quality) => quality.id === qualityId)?.name ?? 'As released'}</SelectTrigger>
            <SelectContent>
              <SelectItem value="">As released</SelectItem>
              {(qualities ?? []).map((quality) => <SelectItem key={quality.id} value={String(quality.id)}>{quality.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </FieldLabelled>
      </div>
    </PanelInline>
  );
}

// Everything a release row shows that depends only on the release, worked out once per result set.
type ReleaseView = { release: Release; risks: string[]; fit: ProfileFit; text: string; name: string; group: string | undefined; hover: string };

const viewOf = (release: Release): ReleaseView => {
  const risks = risksOf(release);
  const notes = [
    ...risks,
    ...release.flags.filter((flag) => flag !== 'Nuked'),
    ...release.past.filter((event) => event.kind === 'grabbed').map(pastText),
    // The table follows the design's columns, which leave out Age, so the age moves to the hover text.
    ...(release.ageHours === null ? [] : [`${formatAge(release.ageHours)} old`]),
  ];
  // The name cell truncates, so the hover text leads with the full release name.
  return { release, risks, ...fitOf(release, risks), ...splitName(release.title), hover: [release.title, notes.join(' · ')].filter((part) => part !== '').join('\n') };
};

// Memoised so moving the selection with the arrow keys re-renders two rows, not every release.
const ReleaseRow = memo(function ReleaseRow({ view, selected, tabbable, best, grabbed, grabbing, showOverride, onSelect, onGrab, onOverride }: {
  view: ReleaseView; selected: boolean; tabbable: boolean; best: boolean; grabbed: boolean; grabbing: boolean; showOverride: boolean;
  onSelect: (guid: string) => void; onGrab: (guid: string) => void; onOverride: () => void;
}) {
  const { release, risks, fit, text, name, group } = view;
  const actions = grabbed
    ? <Badge variant="live" className="bg-best transition-opacity duration-(--duration-base) ease-out starting:opacity-0">Grabbed</Badge>
    : (
      <>
        {showOverride && (
          <Tooltip text="Override what this counts as">
            <Button
              variant="ghost"
              size="row"
              iconOnly
              icon={<SlidersHorizontal className="text-muted-foreground" />}
              aria-label="Override"
              onClick={(event) => { event.stopPropagation(); onOverride(); }}
            />
          </Tooltip>
        )}
        <Button size="row" disabled={grabbing || release.hitAndRun?.cooldown === true} onClick={(event) => { event.stopPropagation(); onGrab(release.guid); }}>
          {grabbing && selected ? 'Grabbing…' : 'Grab'}
        </Button>
      </>
    );
  return (
    <RowRelease
      data-guid={release.guid}
      aria-selected={selected}
      tabIndex={tabbable ? 0 : -1}
      title={view.hover}
      onClick={() => onSelect(release.guid)}
      selected={selected}
      best={best}
      rejected={!release.approved}
      quality={release.quality ?? '–'}
      name={name}
      group={group}
      comparison={best ? <MarkComparison kind="best" />
        : release.compared == null ? '' : <MarkComparison kind={release.compared} />}
      fit={(
        <span className="flex min-w-0 items-center gap-1.5">
          <CellProfileFit fit={fit}>{text}</CellProfileFit>
          {risks.length > 1 && (
            <Tooltip text={risks.slice(1).join(' · ')}>
              <button
                type="button"
                tabIndex={tabbable ? 0 : -1}
                aria-label={`${risks.length - 1} more: ${risks.slice(1).join(', ')}`}
                className="shrink-0 rounded-xs font-data text-sm text-muted-foreground focus-ring"
              >
                +{risks.length - 1}
              </button>
            </Tooltip>
          )}
        </span>
      )}
      size={formatSize(release.size)}
      seeders={release.seeders ?? '?'}
      tracker={release.indexer ?? ''}
      hitAndRun={release.hitAndRun == null ? '–'
        : release.hitAndRun.cooldown ? <span className="text-destructive">cooldown</span>
          : ruleText(release.hitAndRun)}
      audio={audioHdrText(release)}
      actions={actions}
    />
  );
});

export function PickRelease({ target, title, name, episodes, movieHasFile, onClose, onUnauthenticated }: {
  target: ReleaseTarget;
  title: string;
  /** The series or movie name, which leads the grab dialog's description when given. */
  name?: string;
  episodes: OwnedEpisode[];
  movieHasFile: boolean;
  onClose: () => void;
  onUnauthenticated: () => void;
}) {
  const [list, setList] = useState<ListState>({ kind: 'loading' });
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [panel, setPanel] = useState<'decision' | 'override' | undefined>(undefined);
  const [choice, setChoice] = useState<Choice>('replace');
  // Overrides belong to the release they were set on; any other release is sent as released.
  const [override, setOverride] = useState<{ guid: string; value: Overrides } | undefined>(undefined);
  const [qualityFilter, setQualityFilter] = useState<string>(ALL);
  const [qualities, setQualities] = useState<Quality[] | undefined>(undefined);
  const [grabbing, setGrabbing] = useState(false);
  // State lags a render behind, so two fast sends could both read grabbing as false; the ref is set before the first await.
  const inFlight = useRef(false);
  const [grabbed, setGrabbed] = useState<Set<string>>(() => new Set());
  const [outcome, setOutcome] = useState<GrabOutcome | undefined>(undefined);
  const [now, setNow] = useState(Date.now);
  const listRef = useRef<HTMLDivElement>(null);
  const toasts = useToastManager();
  const targetQuery = query(target);
  // Callers may build a new target object on every render; searching again needs a different service or target.
  const searchedTarget = useMemo(() => target, [target.service, targetQuery]);
  const service = serviceLabel(target);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

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
      setNow(Date.now());
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

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/owned/qualities/${target.service}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (Array.isArray(body)) setQualities(body as Quality[]);
      } catch {
        setQualities(undefined);
      }
    })();
  }, [target.service]);

  const releases = list.kind === 'ready' ? list.stored.releases : [];
  const owned = list.kind === 'ready' ? list.stored.owned ?? null : null;
  // Sonarr and Radarr return releases in their own preference order, so the first one that
  // passes the profile is the one they would grab themselves.
  const best = releases.find((release) => release.approved)?.guid;
  const qualityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const release of releases) if (release.quality !== null) counts.set(release.quality, (counts.get(release.quality) ?? 0) + 1);
    return counts;
  }, [releases]);
  const views = useMemo(() => releases.map(viewOf), [releases]);
  const visible = qualityFilter === ALL ? views : views.filter((view) => view.release.quality === qualityFilter);
  // The selected row takes Tab; when the quality filter hides it, the first shown row does, so the list stays reachable.
  const tabbableGuid = visible.some((view) => view.release.guid === selected) ? selected : visible[0]?.release.guid;

  const overridesFor = (guid: string | undefined): Overrides => (override !== undefined && override.guid === guid ? override.value : {});
  const overrides = overridesFor(selected);

  const grabTargetHasFile = (given: Overrides) => (target.kind === 'movie'
    ? movieHasFile
    : given.episodeIds !== undefined
      ? episodes.some((episode) => given.episodeIds!.includes(episode.id) && episode.hasFile)
      : target.kind === 'episode'
        ? episodes.some((episode) => episode.id === target.episodeId && episode.hasFile)
        : episodes.some((episode) => episode.seasonNumber === target.seasonNumber && episode.hasFile));

  const sendGrab = async (guid: string, intent: 'grab' | 'replace') => {
    if (inFlight.current) return;
    inFlight.current = true;
    setGrabbing(true);
    setOutcome(undefined);
    const overrides = overridesFor(guid);
    const overrideBody = Object.keys(overrides).length === 0 ? undefined : {
      ...(overrides.episodeIds === undefined || target.service !== 'sonarr' ? {} : { seriesId: target.seriesId, episodeIds: overrides.episodeIds }),
      ...(overrides.qualityId === undefined ? {} : { qualityId: overrides.qualityId }),
    };
    try {
      const response = await postJson('/api/grabs', {
        target: targetBody(target),
        guid,
        intent,
        ...(overrideBody === undefined ? {} : { overrides: overrideBody }),
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

  // A tracker cooldown refuses every grab from it, so Grab stays off until it ends.
  const onCooldown = (release: Release | undefined) => release?.hitAndRun?.cooldown === true;

  // Enter on a row reaches here while a grab is in flight or done, and the server records and sends every grab it gets.
  const onGrab = (guid: string) => {
    if (grabbing || inFlight.current || grabbed.has(guid)) return;
    if (onCooldown(releases.find((release) => release.guid === guid))) return;
    setSelected(guid);
    if (grabTargetHasFile(overridesFor(guid))) {
      setChoice('replace');
      setPanel('decision');
    } else void sendGrab(guid, 'grab');
  };

  const overridden = overrides.episodeIds !== undefined || overrides.qualityId !== undefined;
  const confirm = () => {
    if (selected === undefined || grabbing || inFlight.current) return;
    // The second-version route takes no overrides, so an overridden release can only replace.
    if (choice === 'second' && !overridden) void sendSecondVersion(selected);
    else void sendGrab(selected, 'replace');
  };

  // The dialog's keys reach here through its portal. 1 and 2 pick; Enter grabs wherever focus sits except on Cancel or
  // Close (both carry data-cancel), caught before the focused button can act on it.
  const onDecisionKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (panel !== 'decision') return;
    if (event.key === '1') setChoice('replace');
    if (event.key === '2' && !overridden) setChoice('second');
    if (event.key === 'Enter' && (event.target as HTMLElement).closest('[data-cancel]') === null) {
      event.preventDefault();
      event.stopPropagation();
      confirm();
    }
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (panel !== undefined) return;
    if (event.key === 'R' && event.shiftKey) {
      event.preventDefault();
      // Same as the Refresh button: off until a search has answered, and once while it runs.
      if (list.kind === 'ready' && !list.refreshing) void load(true);
      return;
    }
    if (event.key === 'Escape') {
      onClose();
      return;
    }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && visible.length > 0) {
      event.preventDefault();
      const index = visible.findIndex((view) => view.release.guid === selected);
      const next = visible[Math.min(visible.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)))].release;
      setSelected(next.guid);
      listRef.current?.querySelector<HTMLElement>(`[data-guid="${CSS.escape(next.guid)}"]`)?.focus();
    }
    // Enter grabs the focused row, which is the selected one except after the quality filter hid the selection.
    const focusedGuid = (event.target as HTMLElement).dataset.guid;
    if (event.key === 'Enter' && focusedGuid !== undefined) {
      event.preventDefault();
      onGrab(focusedGuid);
    }
  };

  const refreshing = list.kind === 'ready' && list.refreshing;

  // Rows are memoised, so the handlers they get keep one identity and read the latest state through this ref.
  const latest = useRef({ onGrab, panel });
  latest.current = { onGrab, panel };
  const selectRow = useCallback((guid: string) => { if (latest.current.panel === undefined) setSelected(guid); }, []);
  const grabRow = useCallback((guid: string) => latest.current.onGrab(guid), []);
  const openOverride = useCallback(() => setPanel('override'), []);

  // What the grab decision describes: the owned file for one episode or movie, the pack and its episodes for a season.
  const chosen = releases.find((release) => release.guid === selected);
  const secondAllowed = !overridden;
  const packEpisodes = target.kind !== 'season' ? [] : episodes
    .filter((episode) => (chosen?.episodeIds !== undefined && chosen.episodeIds.length > 0
      ? chosen.episodeIds.includes(episode.id)
      : episode.seasonNumber === target.seasonNumber))
    .sort((a, b) => a.episodeNumber - b.episodeNumber);
  const missing = packEpisodes.filter((episode) => !episode.hasFile).map((episode) => `E${String(episode.episodeNumber).padStart(2, '0')}`);
  const packNote = [
    `All ${packEpisodes.length} share one torrent, which stays while any of these second versions remains.`,
    missing.length === 0 ? undefined : missing.length === 1
      ? `${missing[0]} has no file yet: it gets a second version only, and Sonarr still lists it as missing.`
      : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]} have no file yet: they get a second version only, and Sonarr still lists them as missing.`,
  ].filter((part) => part !== undefined).join(' ');
  const pad = (number: number) => String(number).padStart(2, '0');
  const targetEpisode = target.kind === 'episode' ? episodes.find((episode) => episode.id === target.episodeId) : undefined;
  const lead = name === undefined ? undefined
    : target.kind === 'season' ? `${name} S${pad(target.seasonNumber)}`
      : targetEpisode === undefined ? name : `${name} S${pad(targetEpisode.seasonNumber)}E${pad(targetEpisode.episodeNumber)}`;
  const incoming = chosen === undefined ? ''
    : `${[chosen.quality, splitName(chosen.title).group, formatSize(chosen.size)].filter((part) => part != null && part !== '').join(' · ')}${chosen.indexer === null ? '' : ` from ${chosen.indexer}`}`;
  const decisionSubject = target.kind === 'season'
    ? `${lead === undefined ? '' : `${lead} · `}${[chosen?.quality, chosen === undefined ? undefined : splitName(chosen.title).group, chosen === undefined ? undefined : formatSize(chosen.size)].filter((part) => part != null && part !== '').join(' · ')}, one torrent with ${packEpisodes.length} episodes. You have files for ${packEpisodes.length - missing.length} of them; their torrents keep seeding either way.`
    : `${incoming === '' ? '' : `Grabbing ${incoming}. `}${owned === null ? (lead === undefined ? '' : `${lead}. `) : `${lead === undefined ? 'Your' : `${lead} · your`} ${[owned.quality, owned.releaseGroup, formatSize(owned.size)].filter((part) => part != null && part !== '').join(' · ')}. `}The current file's torrent keeps seeding either way.`;
  const second = choice === 'second' && secondAllowed;
  const confirmLabel = grabbing
    ? (second ? 'Grabbing…' : 'Replacing…')
    : second
      ? (target.kind === 'season' ? `Grab ${packEpisodes.length} second versions` : 'Grab as second version')
      : (target.kind === 'season' ? 'Grab and replace the current files' : 'Grab and replace the current file');
  const showRows = list.kind === 'ready' && releases.length > 0;

  return (
    <div onKeyDown={onListKeyDown} onKeyDownCapture={onDecisionKeyDown}>
      <PanelInline
        open
        title={`Pick a release for ${title}`}
        onClose={onClose}
        hint={showRows
          ? (
            <span className="inline-flex items-center gap-1">
              <Kbd icon={<ArrowUp aria-hidden="true" />} />
              <Kbd icon={<ArrowDown aria-hidden="true" />} />
              <span className="mr-4">choose a release</span>
              <Kbd>↵</Kbd>
              <span>grab the chosen release</span>
            </span>
          )
          : undefined}
      >
        <div className="flex w-full items-center gap-3 px-5 pb-4">
          {list.kind === 'loading' && (
            <span className="flex items-center gap-2 text-body text-foreground" aria-live="polite">
              <Spinner />
              Searching every indexer. This takes about 20 seconds…
            </span>
          )}
          {showRows && qualityCounts.size > 0 && (
            <ToggleGroup aria-label="Quality" value={qualityFilter} onValueChange={setQualityFilter} className={cn(refreshing && 'opacity-40')}>
              <ToggleGroupItem value={ALL} count={releases.length}>All</ToggleGroupItem>
              {[...qualityCounts].map(([quality, count]) => (
                <ToggleGroupItem key={quality} value={quality} count={count}>{quality}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          {overridden && (
            <span className="flex items-center gap-2 text-body text-foreground">
              Counting as {overrides.episodeIds !== undefined ? `${overrides.episodeIds.length} episode${overrides.episodeIds.length === 1 ? '' : 's'}` : 'released episodes'}
              {overrides.qualityId !== undefined && `, ${qualities?.find((quality) => quality.id === overrides.qualityId)?.name ?? 'chosen quality'}`}
              <Button variant="ghost" size="row" onClick={() => setOverride(undefined)}>Reset</Button>
            </span>
          )}
          <span aria-hidden="true" className="flex-1" />
          {list.kind === 'ready' && (
            <span aria-live="polite" className={cn('text-body', refreshing ? 'text-foreground' : 'text-muted-foreground')}>
              {refreshing ? 'Searching again…' : `Results from ${formatSince(list.stored.fetchedAt, now)}`}
            </span>
          )}
          <Button
            variant="outline"
            icon={<RefreshCw />}
            kbd={refreshing ? undefined : 'Shift R'}
            loading={refreshing}
            disabled={list.kind !== 'ready'}
            onClick={() => void load(true)}
          >
            Refresh
          </Button>
        </div>

        {list.kind === 'failed' && (
          <div className="px-5 pb-5">
            <Callout title={list.problem} action={<Button variant="outline" icon={<RefreshCw />} onClick={() => void load(false)}>Try again</Button>} />
          </div>
        )}
        {list.kind === 'ready' && list.problem !== undefined && (
          <div className="px-5 pb-4">
            <Callout look="warning" title={`${list.problem} These are the earlier results.`} />
          </div>
        )}
        {outcome?.outOfDate === true && (
          <div className="px-5 pb-4">
            <Callout look="warning" title={outcome.message} />
          </div>
        )}

        {list.kind === 'loading' && (
          <>
            <RowReleaseHeader comparison hitAndRun audio />
            {Array.from({ length: 6 }, (_, index) => <SkeletonRow key={index} className="border-b border-border" />)}
          </>
        )}
        {list.kind === 'ready' && releases.length === 0 && (
          <div className="flex justify-center border-t border-border pt-10 pb-12">
            <EmptyState
              icon={<SearchX />}
              title="No indexer has a release for this"
              action={<Button variant="outline" icon={<RefreshCw />} loading={refreshing} onClick={() => void load(true)}>Search again</Button>}
            />
          </div>
        )}
        {showRows && (
          <div ref={listRef} role="table" aria-label="Releases" className="flex flex-col border-t border-border">
            <RowReleaseHeader comparison hitAndRun audio />
            {owned !== null && (() => {
              // The owned file stays pinned under the header whatever the quality filter shows.
              const { name, group } = splitName((owned.releaseTitle ?? '').replace(/\.(mkv|mp4|m4v|avi|ts)$/i, ''));
              return (
                <RowRelease
                  yours
                  aria-label="Your current file"
                  quality={owned.quality ?? '–'}
                  name={name}
                  group={group ?? owned.releaseGroup ?? undefined}
                  comparison={<MarkComparison kind="yours" />}
                  fit={owned.qualityCutoffNotMet
                    ? <CellProfileFit fit="warning">below cutoff</CellProfileFit>
                    : <CellProfileFit fit="meets">cutoff met</CellProfileFit>}
                  size={formatSize(owned.size)}
                  seeders=""
                  tracker={owned.hitAndRun?.host ?? ''}
                  hitAndRun={owned.hitAndRun === null ? '–' : seededText(owned.hitAndRun)}
                  audio={audioHdrText(owned)}
                />
              );
            })()}
            {visible.map((view) => {
              const { release } = view;
              const isSelected = release.guid === selected;
              return (
                <Fragment key={release.guid}>
                  <ReleaseRow
                    view={view}
                    selected={isSelected}
                    tabbable={release.guid === tabbableGuid}
                    best={release.guid === best}
                    grabbed={grabbed.has(release.guid)}
                    grabbing={grabbing}
                    showOverride={isSelected && panel === undefined}
                    onSelect={selectRow}
                    onGrab={grabRow}
                    onOverride={openOverride}
                  />
                  {outcome?.guid === release.guid && !outcome.outOfDate && (
                    <div className="flex min-h-8 items-center border-b border-border bg-muted px-4 py-1">
                      <StatusInline status="failed">{outcome.message}</StatusInline>
                    </div>
                  )}
                  {isSelected && panel === 'override' && (
                    <div className="border-b border-border bg-muted p-2">
                      <OverridePanel
                        target={target}
                        episodes={episodes}
                        qualities={qualities}
                        value={overrides}
                        onApply={(value) => { setOverride({ guid: release.guid, value }); setPanel(undefined); }}
                        onCancel={() => setPanel(undefined)}
                      />
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        )}
      </PanelInline>

      <Dialog
        open={panel === 'decision' && grabTargetHasFile(overrides)}
        onOpenChange={(open) => { if (!open) setPanel(undefined); }}
        title={target.kind === 'season'
          ? `${seasonName(target.seasonNumber)} ${target.seasonNumber === 0 ? 'are' : 'is'} already in your library`
          : 'This is already in your library'}
        subject={decisionSubject}
        footerCallout={outcome === undefined || outcome.guid !== selected ? undefined : <Callout look={outcome.outOfDate ? 'warning' : 'risk'} title={outcome.message} />}
        actions={(
          <>
            <Button variant="outline" kbd="Esc" data-cancel="" disabled={grabbing} onClick={() => setPanel(undefined)}>Cancel</Button>
            <Button
              size="large"
              kbd="↵"
              icon={grabbing ? <Spinner className="text-current" /> : undefined}
              disabled={grabbing || selected === undefined}
              onClick={confirm}
            >
              {confirmLabel}
            </Button>
          </>
        )}
      >
        <RadioGroup
          value={secondAllowed ? choice : 'replace'}
          onValueChange={(value) => setChoice(value as Choice)}
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
            description={`${target.kind === 'season' ? 'Adds a second version to each episode below, side by side in Plex.' : 'Keeps both files side by side in Plex.'}${secondAllowed ? '' : ' Not available while this release is overridden.'}`}
          />
        </RadioGroup>
        {target.kind === 'season' && packEpisodes.length > 0 && (
          <div className="flex flex-col gap-2 pt-3">
            <span className="flex items-center gap-1.5 font-ui text-sm font-semibold text-foreground">
              Episodes in this release
              <span className="font-data text-[13px] font-normal text-subtle-foreground">{packEpisodes.length}</span>
            </span>
            <div className="flex flex-col rounded-md border border-border">
              {packEpisodes.map((episode) => (
                <div key={episode.id} className="flex h-7 items-center gap-2 border-b border-border px-3 last:border-b-0">
                  <span className="w-6 shrink-0 font-data text-[13px] font-medium text-muted-foreground">E{String(episode.episodeNumber).padStart(2, '0')}</span>
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
