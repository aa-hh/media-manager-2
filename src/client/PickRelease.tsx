import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from './components/ui/button';
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

type GrabOutcome = { guid: string; ok: boolean; message: string };

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
  if (hours === null) return '';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} d`;
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

function DecisionPanel({ owned, busy, onReplace, onCancel }: {
  owned: boolean;
  busy: boolean;
  onReplace: () => void;
  onCancel: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => firstRef.current?.focus(), []);
  if (!owned) return null;
  return (
    <div
      role="group"
      aria-label="Replace or keep as a second version"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onCancel();
        }
      }}
      className="border-y border-[var(--ink)] bg-[var(--control)] px-4 py-4 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-30 max-sm:border-x-0 max-sm:border-b-0 max-sm:shadow-none sm:px-6"
    >
      <p className="text-sm text-[var(--secondary-ink)]">This is already in your library. The current file's torrent keeps seeding either way.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          {confirming
            ? (
              <Button ref={firstRef} disabled={busy} onClick={onReplace} className="min-h-10 justify-start border-[#b42318] text-[#b42318]">
                {busy ? 'Replacing…' : 'Yes, replace the current file'}
              </Button>
            )
            : (
              <Button ref={firstRef} onClick={() => setConfirming(true)} className="min-h-10 justify-start">Replace</Button>
            )}
          <p className="text-sm text-[var(--secondary-ink)]">
            The new release becomes the tracked file, even at lower quality, and is kept from automatic upgrades.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button disabled className="min-h-10 justify-start">Second version</Button>
          <p className="text-sm text-[var(--secondary-ink)]">Keeps both files side by side in Plex. Not available yet.</p>
        </div>
      </div>
      <button type="button" onClick={onCancel} className="mt-3 text-sm font-medium text-[var(--secondary-ink)] hover:text-[var(--ink)]">
        Cancel (Esc)
      </button>
    </div>
  );
}

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
  return (
    <div className="border-y border-[var(--border)] bg-[var(--control)] px-4 py-4 sm:px-6">
      <p className="text-sm font-medium text-[var(--ink)]">What this release counts as</p>
      <div className="mt-3 flex flex-wrap gap-6">
        {target.service === 'sonarr' && episodes.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm text-[var(--secondary-ink)]">Episodes</legend>
            <select
              aria-label="Season"
              value={season ?? ''}
              onChange={(event) => setSeason(Number(event.target.value))}
              className="h-9 w-40 rounded-md border border-[var(--border)] bg-[var(--control)] px-2 text-sm"
            >
              {seasons.map((number) => <option key={number} value={number}>{number === 0 ? 'Specials' : `Season ${number}`}</option>)}
            </select>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto pr-2">
              {episodes.filter((episode) => episode.seasonNumber === season).map((episode) => (
                <label key={episode.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--ink)]"
                    checked={episodeIds.includes(episode.id)}
                    onChange={(event) => setEpisodeIds(event.target.checked
                      ? [...episodeIds, episode.id]
                      : episodeIds.filter((id) => id !== episode.id))}
                  />
                  <span className="tabular-nums">{String(episode.episodeNumber).padStart(2, '0')}</span>
                  {episode.title}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <label className="flex flex-col gap-2 text-sm text-[var(--secondary-ink)]">
          Quality
          <select
            value={qualityId ?? ''}
            onChange={(event) => setQualityId(event.target.value === '' ? undefined : Number(event.target.value))}
            disabled={qualities === undefined}
            className="h-9 w-48 rounded-md border border-[var(--border)] bg-[var(--control)] px-2 text-sm text-[var(--ink)]"
          >
            <option value="">As released</option>
            {(qualities ?? []).map((quality) => <option key={quality.id} value={quality.id}>{quality.name}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4 flex gap-3">
        <Button
          className="min-h-9"
          disabled={target.service === 'sonarr' && episodes.length > 0 && episodeIds.length === 0}
          onClick={() => onApply({
            ...(target.service === 'sonarr' && episodes.length > 0 ? { episodeIds } : {}),
            ...(qualityId === undefined ? {} : { qualityId }),
          })}
        >
          Use this
        </Button>
        <Button variant="quiet" className="min-h-9" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
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
  const [qualityFilter, setQualityFilter] = useState<string | undefined>(undefined);
  const [qualities, setQualities] = useState<Quality[] | undefined>(undefined);
  const [grabbing, setGrabbing] = useState(false);
  const [outcome, setOutcome] = useState<GrabOutcome | undefined>(undefined);
  const [now, setNow] = useState(Date.now);
  const listRef = useRef<HTMLDivElement>(null);
  const targetQuery = query(target);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const load = useCallback(async (refresh: boolean) => {
    setList((current) => (current.kind === 'ready' ? { ...current, refreshing: true, problem: undefined } : { kind: 'loading' }));
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
  const visible = qualityFilter === undefined ? releases : releases.filter((release) => release.quality === qualityFilter);

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
        setOutcome({
          guid,
          ok: true,
          message: intent === 'replace'
            ? `Sent to ${serviceLabel(target)}. media-manager-2 will finish the replace when the download completes.`
            : `Sent to ${serviceLabel(target)}.`,
        });
        setPanel(undefined);
      } else {
        setOutcome({
          guid,
          ok: false,
          message: typeof body.reason === 'string' ? `${serviceLabel(target)} refused the grab: ${body.reason}`
            : body.error === 'unknown_release' ? 'These results are out of date. Refresh and pick again.'
              : `${serviceLabel(target)} didn't take the grab.`,
        });
      }
    } catch {
      setOutcome({ guid, ok: false, message: "The grab didn't reach media-manager-2's server." });
    } finally {
      setGrabbing(false);
    }
  };

  const onGrab = (guid: string) => {
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

  return (
    <section aria-label={`Pick a release for ${title}`} className="mt-4 border-t border-[var(--border)]" onKeyDown={onListKeyDown}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <h3 className="font-semibold text-[var(--ink)]">Pick a release</h3>
        <span className="text-sm text-[var(--secondary-ink)]" aria-live="polite">
          {list.kind === 'loading' && 'Searching every indexer. This takes about 20 seconds…'}
          {list.kind === 'ready' && (list.refreshing ? 'Searching again…' : `Results from ${formatSince(list.stored.fetchedAt, now)}`)}
        </span>
        {list.kind === 'ready' && (
          <Button variant="quiet" className="min-h-8 px-2 text-sm" disabled={list.refreshing} onClick={() => void load(true)}>
            Refresh <kbd className="ml-1 text-xs">⇧R</kbd>
          </Button>
        )}
        {(overrides.episodeIds !== undefined || overrides.qualityId !== undefined) && (
          <span className="text-sm text-[var(--ink)]">
            Counting as {overrides.episodeIds !== undefined ? `${overrides.episodeIds.length} episode${overrides.episodeIds.length === 1 ? '' : 's'}` : 'released episodes'}
            {overrides.qualityId !== undefined && `, ${qualities?.find((quality) => quality.id === overrides.qualityId)?.name ?? 'chosen quality'}`}
            <button type="button" onClick={() => setOverrides({})} className="ml-2 underline underline-offset-2">Reset</button>
          </span>
        )}
        <button type="button" onClick={onClose} className="ml-auto text-sm font-medium text-[var(--secondary-ink)] hover:text-[var(--ink)]">Close</button>
      </div>
      {list.kind === 'failed' && <p role="alert" className="px-4 pb-3 text-[#b42318] sm:px-6">{list.problem}</p>}
      {list.kind === 'ready' && list.problem !== undefined && (
        <p role="alert" className="px-4 pb-3 text-sm text-[#b42318] sm:px-6">{list.problem} These are the earlier results.</p>
      )}
      {qualitiesShown.length > 1 && (
        <div role="group" aria-label="Quality" className="flex flex-wrap gap-1.5 px-4 pb-3 sm:px-6">
          {[undefined, ...qualitiesShown].map((quality) => (
            <button
              key={quality ?? 'all'}
              type="button"
              aria-pressed={qualityFilter === quality}
              onClick={() => setQualityFilter(quality)}
              className={cn('h-7 rounded px-2 text-sm', qualityFilter === quality ? 'bg-[var(--ink)] text-[var(--control)]' : 'border border-[var(--border)] text-[var(--secondary-ink)]')}
            >
              {quality ?? 'All'}
            </button>
          ))}
        </div>
      )}
      {list.kind === 'ready' && releases.length === 0 && (
        <p className="px-4 pb-4 text-[var(--secondary-ink)] sm:px-6">No indexer has a release for this.</p>
      )}
      <div ref={listRef} role="listbox" aria-label="Releases" className="divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm">
        {visible.map((release) => {
          const isSelected = release.guid === selected;
          const isBest = release.guid === best;
          const risks = risksOf(release);
          const dimmed = panel !== undefined && !isSelected;
          return (
            <div key={release.guid} className={cn(dimmed && 'opacity-40')}>
              <div
                role="option"
                aria-selected={isSelected}
                tabIndex={isSelected || (selected === undefined && release === visible[0]) ? 0 : -1}
                data-guid={release.guid}
                onClick={() => {
                  if (panel !== undefined) return;
                  setSelected(release.guid);
                }}
                className={cn(
                  'grid cursor-default grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-l-4 px-4 py-2 outline-none sm:grid-cols-[minmax(0,1fr)_7rem_5rem_4rem_4rem_5rem_auto] sm:items-center sm:px-6',
                  isBest ? 'border-l-[#8b3fd9]' : 'border-l-transparent',
                  isSelected ? 'bg-[var(--quiet-hover)]' : 'hover:bg-[var(--control-hover)]',
                  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--focus)]',
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isBest && <span className="rounded bg-[#8b3fd9] px-1.5 text-xs font-semibold leading-5 text-white">Best</span>}
                    <span className={cn('break-all', release.approved ? 'text-[var(--ink)]' : 'text-[var(--secondary-ink)]')}>{release.title}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-[var(--secondary-ink)]">
                    {release.flags.filter((flag) => flag !== 'Nuked').map((flag) => <span key={flag}>{flag}</span>)}
                    {release.past.filter((event) => event.kind === 'grabbed').map((event) => <span key={`${event.kind}${event.at}`}>{pastText(event)}</span>)}
                  </div>
                  {risks.length > 0 && (
                    <ul className="mt-0.5 text-xs text-[#b42318]">
                      {risks.map((risk) => <li key={risk}>{risk}</li>)}
                    </ul>
                  )}
                </div>
                <span className="tabular-nums text-[var(--ink)] max-sm:col-start-1 max-sm:text-xs">
                  {release.quality}
                  <span className="sm:hidden"> · {formatSize(release.size)} · {formatAge(release.ageHours)} · {release.seeders ?? '?'} seeders · {release.indexer}</span>
                </span>
                <span className="tabular-nums text-[var(--secondary-ink)] max-sm:hidden">{formatSize(release.size)}</span>
                <span className="tabular-nums text-[var(--secondary-ink)] max-sm:hidden">{formatAge(release.ageHours)}</span>
                <span className={cn('tabular-nums max-sm:hidden', release.seeders === 0 ? 'text-[#b42318]' : 'text-[var(--secondary-ink)]')}>
                  {release.seeders ?? '?'}
                  <span className="sr-only"> seeders</span>
                </span>
                <span className="truncate text-[var(--secondary-ink)] max-sm:hidden">{release.indexer}</span>
                <span className="flex items-center justify-end gap-2 max-sm:col-start-2 max-sm:row-span-2 max-sm:row-start-1">
                  <span className={cn('tabular-nums text-xs', release.customFormatScore < 0 ? 'text-[#b42318]' : 'text-[var(--secondary-ink)]')} title="Custom format score">
                    {release.customFormatScore > 0 ? '+' : ''}{release.customFormatScore}
                  </span>
                  {isSelected && panel === undefined && (
                    <>
                      <Button variant="quiet" className="min-h-8 px-2 text-sm" onClick={(event) => { event.stopPropagation(); setPanel('override'); }}>Override</Button>
                      <Button className="min-h-8 px-3 text-sm" disabled={grabbing} onClick={(event) => { event.stopPropagation(); onGrab(release.guid); }}>
                        {grabbing ? 'Grabbing…' : 'Grab'}
                      </Button>
                    </>
                  )}
                </span>
              </div>
              {outcome?.guid === release.guid && (
                <p role={outcome.ok ? 'status' : 'alert'} className={cn('px-4 pb-2 text-sm sm:px-6', outcome.ok ? 'text-[var(--ink)]' : 'text-[#b42318]')}>
                  {outcome.message}
                </p>
              )}
              {isSelected && panel === 'decision' && (
                <DecisionPanel owned={grabTargetHasFile} busy={grabbing} onReplace={() => void sendGrab(release.guid, 'replace')} onCancel={() => setPanel(undefined)} />
              )}
              {isSelected && panel === 'override' && (
                <OverridePanel
                  target={target}
                  episodes={episodes}
                  qualities={qualities}
                  value={overrides}
                  onApply={(value) => { setOverrides(value); setPanel(undefined); }}
                  onCancel={() => setPanel(undefined)}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
