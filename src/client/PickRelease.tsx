import { ArrowDown, ArrowUp, RefreshCw, SearchX, SlidersHorizontal } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
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
import { MarkComparison } from './components/ui/mark-comparison';
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
};

type Stored = { fetchedAt: number; releases: Release[] };

type ListState =
  | { kind: 'loading' }
  | { kind: 'ready'; stored: Stored; refreshing: boolean; problem?: string }
  | { kind: 'failed'; problem: string };

type Quality = { id: number; name: string };

type Overrides = { episodeIds?: number[]; qualityId?: number };

type GrabOutcome = { guid: string; message: string; outOfDate: boolean };

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

// Risks are what could make this grab go wrong, always spelled out rather than coloured alone.
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

export function PickRelease({ target, title, episodes, movieHasFile, onClose, onUnauthenticated }: {
  target: ReleaseTarget;
  title: string;
  episodes: OwnedEpisode[];
  movieHasFile: boolean;
  onClose: () => void;
  onUnauthenticated: () => void;
}) {
  const [list, setList] = useState<ListState>({ kind: 'loading' });
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [panel, setPanel] = useState<'decision' | 'override' | undefined>(undefined);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [qualityFilter, setQualityFilter] = useState<string>(ALL);
  const [qualities, setQualities] = useState<Quality[] | undefined>(undefined);
  const [grabbing, setGrabbing] = useState(false);
  const [grabbed, setGrabbed] = useState<Set<string>>(() => new Set());
  const [outcome, setOutcome] = useState<GrabOutcome | undefined>(undefined);
  const [now, setNow] = useState(Date.now);
  const listRef = useRef<HTMLDivElement>(null);
  const toasts = useToastManager();
  const targetQuery = query(target);
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
        ? await postJson('/api/releases/refresh', targetBody(target))
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
      const problem = problemText(target, body.error);
      setList(stored ? { kind: 'ready', stored, refreshing: false, problem } : { kind: 'failed', problem });
    } catch {
      setList((current) => (current.kind === 'ready'
        ? { ...current, refreshing: false, problem: "The search didn't reach media-manager-2's server." }
        : { kind: 'failed', problem: "The search didn't reach media-manager-2's server." }));
    }
  }, [targetQuery, target, onUnauthenticated]);

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
  // Sonarr and Radarr return releases in their own preference order, so the first one that
  // passes the profile is the one they would grab themselves.
  const best = releases.find((release) => release.approved)?.guid;
  const qualitiesShown = useMemo(() => [...new Set(releases.map((release) => release.quality).filter((quality): quality is string => quality !== null))], [releases]);
  const visible = qualityFilter === ALL ? releases : releases.filter((release) => release.quality === qualityFilter);

  const grabTargetHasFile = target.kind === 'movie'
    ? movieHasFile
    : overrides.episodeIds !== undefined
      ? episodes.some((episode) => overrides.episodeIds!.includes(episode.id) && episode.hasFile)
      : target.kind === 'episode'
        ? episodes.some((episode) => episode.id === target.episodeId && episode.hasFile)
        : episodes.some((episode) => episode.seasonNumber === target.seasonNumber && episode.hasFile);

  const sendGrab = async (guid: string, intent: 'grab' | 'replace') => {
    setGrabbing(true);
    setOutcome(undefined);
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
        toasts.add({
          title: `Sent to ${service}.`,
          description: intent === 'replace' ? 'media-manager-2 will finish the replace when the download completes.' : undefined,
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
      setGrabbing(false);
    }
  };

  const onGrab = (guid: string) => {
    setSelected(guid);
    if (grabTargetHasFile) setPanel('decision');
    else void sendGrab(guid, 'grab');
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (panel !== undefined) return;
    if (event.key === 'R' && event.shiftKey) {
      event.preventDefault();
      void load(true);
      return;
    }
    if (event.key === 'Escape') {
      onClose();
      return;
    }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && visible.length > 0) {
      event.preventDefault();
      const index = visible.findIndex((release) => release.guid === selected);
      const next = visible[Math.min(visible.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)))];
      setSelected(next.guid);
      listRef.current?.querySelector<HTMLElement>(`[data-guid="${CSS.escape(next.guid)}"]`)?.focus();
    }
    if (event.key === 'Enter' && selected !== undefined && (event.target as HTMLElement).dataset.guid !== undefined) {
      event.preventDefault();
      onGrab(selected);
    }
  };

  const refreshing = list.kind === 'ready' && list.refreshing;
  const showRows = list.kind === 'ready' && releases.length > 0;
  const overridden = overrides.episodeIds !== undefined || overrides.qualityId !== undefined;

  return (
    <div onKeyDown={onListKeyDown}>
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
          {showRows && qualitiesShown.length > 0 && (
            <ToggleGroup aria-label="Quality" value={qualityFilter} onValueChange={setQualityFilter} className={cn(refreshing && 'opacity-40')}>
              <ToggleGroupItem value={ALL} count={releases.length}>All</ToggleGroupItem>
              {qualitiesShown.map((quality) => (
                <ToggleGroupItem key={quality} value={quality} count={releases.filter((release) => release.quality === quality).length}>{quality}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          {overridden && (
            <span className="flex items-center gap-2 text-body text-foreground">
              Counting as {overrides.episodeIds !== undefined ? `${overrides.episodeIds.length} episode${overrides.episodeIds.length === 1 ? '' : 's'}` : 'released episodes'}
              {overrides.qualityId !== undefined && `, ${qualities?.find((quality) => quality.id === overrides.qualityId)?.name ?? 'chosen quality'}`}
              <Button variant="ghost" size="row" onClick={() => setOverrides({})}>Reset</Button>
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
            <RowReleaseHeader age />
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
            <RowReleaseHeader age />
            {visible.map((release) => {
              const isSelected = release.guid === selected;
              const risks = risksOf(release);
              const { fit, text } = fitOf(release, risks);
              const { name, group } = splitName(release.title);
              const notes = [
                ...risks,
                ...release.flags.filter((flag) => flag !== 'Nuked'),
                ...release.past.filter((event) => event.kind === 'grabbed').map(pastText),
              ];
              const actions = grabbed.has(release.guid)
                ? <Badge variant="live" className="bg-best transition-opacity duration-(--duration-base) ease-out starting:opacity-0">Grabbed</Badge>
                : (
                  <>
                    {isSelected && panel === undefined && (
                      <Tooltip text="Override what this counts as">
                        <Button
                          variant="ghost"
                          size="row"
                          iconOnly
                          icon={<SlidersHorizontal className="text-muted-foreground" />}
                          aria-label="Override"
                          onClick={(event) => { event.stopPropagation(); setPanel('override'); }}
                        />
                      </Tooltip>
                    )}
                    <Button size="row" disabled={grabbing} onClick={(event) => { event.stopPropagation(); onGrab(release.guid); }}>
                      {grabbing && isSelected ? 'Grabbing…' : 'Grab'}
                    </Button>
                  </>
                );
              return (
                <Fragment key={release.guid}>
                  <RowRelease
                    data-guid={release.guid}
                    aria-selected={isSelected}
                    tabIndex={isSelected || (selected === undefined && release === visible[0]) ? 0 : -1}
                    title={notes.length === 0 ? undefined : notes.join(' · ')}
                    onClick={() => { if (panel === undefined) setSelected(release.guid); }}
                    selected={isSelected}
                    best={release.guid === best}
                    rejected={!release.approved}
                    quality={release.quality ?? '–'}
                    name={name}
                    group={group}
                    fit={(
                      <span className="flex min-w-0 items-center gap-1.5">
                        {release.guid === best && <MarkComparison kind="best" />}
                        <CellProfileFit fit={fit}>{text}</CellProfileFit>
                      </span>
                    )}
                    size={formatSize(release.size)}
                    age={formatAge(release.ageHours)}
                    seeders={release.seeders ?? '?'}
                    tracker={release.indexer ?? ''}
                    actions={actions}
                  />
                  {outcome?.guid === release.guid && !outcome.outOfDate && (
                    <div className="flex h-8 items-center border-b border-border bg-muted px-4">
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
                        onApply={(value) => { setOverrides(value); setPanel(undefined); }}
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
        open={panel === 'decision' && grabTargetHasFile}
        onOpenChange={(open) => { if (!open) setPanel(undefined); }}
        title="This is already in your library"
        subject="The current file's torrent keeps seeding either way."
        footerCallout={outcome === undefined || outcome.guid !== selected ? undefined : <Callout look={outcome.outOfDate ? 'warning' : 'risk'} title={outcome.message} />}
        actions={(
          <>
            <Button variant="outline" kbd="Esc" disabled={grabbing} onClick={() => setPanel(undefined)}>Cancel</Button>
            <Button
              size="large"
              icon={grabbing ? <Spinner className="text-current" /> : undefined}
              disabled={grabbing || selected === undefined}
              onClick={() => { if (selected !== undefined) void sendGrab(selected, 'replace'); }}
            >
              {grabbing ? 'Replacing…' : 'Grab and replace the current file'}
            </Button>
          </>
        )}
      >
        <RadioGroup value="replace" aria-label="Replace or keep as a second version" className="flex flex-col gap-2">
          <CardChoice
            value="replace"
            title="Replace tracked version"
            description="The new release becomes the tracked file, even at lower quality, and is kept from automatic upgrades."
          />
          <CardChoice value="second" disabled title="Keep as second version" description="Keeps both files side by side in Plex. Not available yet." />
        </RadioGroup>
      </Dialog>
    </div>
  );
}
