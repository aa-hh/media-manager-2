import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible-trigger';
import { Dialog } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger, SelectContent, SelectItem } from '@/components/ui/dropdown-menu';
import { FactRow } from '@/components/ui/fact';
import { Logo } from '@/components/ui/logo';
import { inlineTriggerClass, Select, SelectTrigger } from '@/components/ui/select-trigger';
import { StatusInline } from '@/components/ui/status-inline';
import { useToastManager } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getJson, postJson } from '../library/api';
import type { Subject } from './TitleHeader';

type QualityProfile = { id: number; name: string };
type RootFolder = { path: string; freeSpace: number | null };
type Options = { qualityProfiles: QualityProfile[]; rootFolders: RootFolder[] };

type SeriesType = 'standard' | 'daily' | 'anime';

type Choices = {
  monitor: string;
  qualityProfileId: number;
  rootFolderPath: string;
  minimumAvailability: string;
  seriesType: SeriesType;
  seasonFolder: boolean;
  monitorNewSeasons: boolean;
  seasons: number[];
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; options: Options };

type AddState =
  | { kind: 'editing' }
  | { kind: 'adding' }
  | { kind: 'refused'; message: string }
  | { kind: 'added' };

type Airing = { seasons: Array<{ seasonNumber: number; aired: number }> | null; nextAirDate: string | null };
type CollectionSize = { films: number; allReleased: boolean } | null;

const seriesMonitorLabels: Array<[string, string]> = [
  ['all', 'all episodes'],
  ['future', 'future episodes'],
  ['lastSeason', 'newest season'],
  ['skip', 'specific seasons'],
  ['none', 'no episodes'],
];
const movieMonitorLabels: Array<[string, string]> = [
  ['movieOnly', 'just the movie'],
  ['movieAndCollection', 'entire collection'],
  ['none', 'nothing'],
];
const availabilityLabels: Array<[string, string]> = [
  ['announced', 'announced'],
  ['inCinemas', 'in cinemas'],
  ['released', 'available'],
];
const seriesTypeLabels: Array<[string, string]> = [['standard', 'Standard'], ['daily', 'Daily'], ['anime', 'Anime']];
const onOffLabels: Array<[string, string]> = [['on', 'On'], ['off', 'Off']];

const labelOf = (labels: Array<[string, string]>, value: string) => labels.find(([key]) => key === value)?.[1] ?? value;
const onOff = (value: boolean) => (value ? 'On' : 'Off');
const seasonName = (seasonNumber: number) => (seasonNumber === 0 ? 'Specials' : `Season ${seasonNumber}`);
const airDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const failureMessage = (service: 'Sonarr' | 'Radarr', error: unknown, fallback: string) => {
  if (error === 'not_configured') return `${service} isn't connected yet.`;
  if (error === 'rejected') return `${service} refused the API key.`;
  if (error === 'unreachable') return `${service} didn't answer.`;
  if (error === 'not_found') return `${service} no longer finds this title.`;
  return fallback;
};

const readBody = async (response: Response): Promise<Record<string, unknown>> => {
  try {
    const value: unknown = await response.json();
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

// Keeps punctuation on the same line as the chip before it; the sentence's flex gap would otherwise push it away.
const withMark = (node: ReactNode, mark: string) => <span className="inline-flex items-center">{node}{mark}</span>;

// A More options select as wide as its longest option, so the chevron stays at the row's right edge whatever is chosen.
function FixedWidthSelect({ label, value, labels, disabled, onChange }: {
  label: string;
  value: string;
  labels: Array<[string, string]>;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(String(next))} disabled={disabled}>
      <SelectTrigger aria-label={`${label}: ${labelOf(labels, value)}`}>
        <span className="grid">
          {labels.map(([key, text]) => (
            <span key={key} className={cn('col-start-1 row-start-1', key !== value && 'invisible')}>{text}</span>
          ))}
        </span>
      </SelectTrigger>
      <SelectContent>
        {labels.map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function AddControls({ subject, onAdded, onUnauthenticated }: {
  subject: Subject;
  onAdded: (libraryId: number) => void;
  onUnauthenticated: () => void;
}) {
  const tv = subject.type === 'tv';
  const { detail } = subject;
  const service = tv ? 'sonarr' : 'radarr';
  const serviceName = tv ? 'Sonarr' : 'Radarr';
  const tmdbId = detail.links.tmdbId;
  const collectionTmdbId = subject.type === 'movie' ? subject.detail.collectionTmdbId : null;
  const toasts = useToastManager();
  const [open, setOpen] = useState(false);
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [choices, setChoices] = useState<Choices | undefined>(undefined);
  const [airing, setAiring] = useState<Airing | undefined>(undefined);
  const [collection, setCollection] = useState<CollectionSize | undefined>(undefined);
  const [more, setMore] = useState(false);
  const [add, setAdd] = useState<AddState>({ kind: 'editing' });

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/add/options/${service}`, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (response.status === 401) {
          onUnauthenticated();
          return;
        }
        const body = await readBody(response);
        if (!response.ok) {
          setLoad({ kind: 'failed', message: failureMessage(serviceName, body.error, `${serviceName}'s add options didn't load.`) });
          return;
        }
        const options = body as unknown as Options;
        if (options.qualityProfiles.length === 0) {
          setLoad({ kind: 'failed', message: `${serviceName} has no quality profile. Create one in ${serviceName} to add titles.` });
          return;
        }
        if (options.rootFolders.length === 0) {
          setLoad({ kind: 'failed', message: `${serviceName} has no root folder. Add one in ${serviceName} to add titles.` });
          return;
        }
        setChoices({
          monitor: tv ? 'all' : 'movieOnly',
          qualityProfileId: options.qualityProfiles[0].id,
          rootFolderPath: options.rootFolders[0].path,
          minimumAvailability: 'released',
          seriesType: 'standard',
          seasonFolder: true,
          monitorNewSeasons: true,
          seasons: [],
        });
        setLoad({ kind: 'ready', options });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoad({ kind: 'failed', message: `${serviceName}'s add options didn't load.` });
      }
    })();
    return () => controller.abort();
  }, [tv, service, serviceName, onUnauthenticated]);

  // TMDB fills the counts and dates; the sentence never waits for them, and a failure reads as no data.
  useEffect(() => {
    const controller = new AbortController();
    if (tv && tmdbId !== null) {
      getJson<Airing>(`/api/library/tmdb/tv/${tmdbId}/airing`, onUnauthenticated, controller.signal)
        .catch((): Airing => ({ seasons: null, nextAirDate: null }))
        .then((body) => { if (!controller.signal.aborted) setAiring(body); });
    }
    if (!tv && collectionTmdbId !== null) {
      getJson<{ collection: CollectionSize }>(`/api/library/tmdb/collection/${collectionTmdbId}`, onUnauthenticated, controller.signal)
        .then((body) => body.collection)
        .catch((): CollectionSize => null)
        .then((body) => { if (!controller.signal.aborted) setCollection(body); });
    }
    return () => controller.abort();
  }, [tv, tmdbId, collectionTmdbId, onUnauthenticated]);

  const adding = add.kind === 'adding' || add.kind === 'added';
  const update = (patch: Partial<Choices>) => setChoices((current) => (current === undefined ? current : { ...current, ...patch }));
  const seasonsMissing = tv && choices?.monitor === 'skip' && choices.seasons.length === 0;

  const submit = async () => {
    if (choices === undefined) return;
    setAdd({ kind: 'adding' });
    const { monitor, qualityProfileId, rootFolderPath } = choices;
    try {
      const response = await postJson('/api/add', {
        service,
        id: subject.type === 'tv' ? subject.detail.links.tvdbId : subject.detail.links.tmdbId,
        choices: tv
          ? {
            monitor,
            monitorNewSeasons: choices.monitorNewSeasons,
            qualityProfileId,
            rootFolderPath,
            seasonFolder: choices.seasonFolder,
            seriesType: choices.seriesType,
            ...(monitor === 'skip' ? { seasons: choices.seasons } : {}),
          }
          : { monitor, minimumAvailability: choices.minimumAvailability, qualityProfileId, rootFolderPath },
      });
      if (response.status === 401) {
        onUnauthenticated();
        return;
      }
      const body = await readBody(response);
      if (response.status === 201 && typeof body.libraryId === 'number') {
        setAdd({ kind: 'added' });
        toasts.add({
          title: `Added to ${serviceName}`,
          description: monitor === 'none'
            ? 'No search was started.'
            : tv ? 'Sonarr is searching for the monitored episodes that have aired.' : 'Radarr is searching for the movie.',
        });
        onAdded(body.libraryId);
        return;
      }
      setAdd({
        kind: 'refused',
        message: body.error === 'refused' && typeof body.reason === 'string'
          ? body.reason
          : failureMessage(serviceName, body.error, `${serviceName} didn't add it.`),
      });
    } catch {
      setAdd({ kind: 'refused', message: "The add didn't reach media-manager-2's server." });
    }
  };

  // Three lines, one fact each: who adds it, what gets monitored, and what the search covers. A line with nothing to say is left out.
  const sentence = (options: Options, current: Choices): ReactNode[][] => {
    const monitorLabels = tv ? seriesMonitorLabels : movieMonitorLabels.filter(([key]) => key !== 'movieAndCollection' || subject.type !== 'movie' || subject.detail.collection !== null);
    const monitorLabel = labelOf(monitorLabels, current.monitor);
    const monitorChip = (
      <Select key="monitor" value={current.monitor} onValueChange={(monitor) => update({ monitor: String(monitor) })} disabled={adding}>
        <SelectTrigger variant="inline" aria-label={`Monitor: ${monitorLabel}`}>{monitorLabel}</SelectTrigger>
        <SelectContent>
          {monitorLabels.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
    const pill = (value: ReactNode) => <Badge variant="inline">{value}</Badge>;

    const intro: ReactNode[] = [
      <Badge key="service" variant="inline"><Logo name={service} alt="" />{serviceName}</Badge>,
      `will add ${detail.title} to your library.`,
    ];
    const monitoring: ReactNode[] = ['Monitor'];
    if (current.monitor === 'none') {
      monitoring.push(<span key="monitor">{withMark(monitorChip, '.')}</span>);
      return [intro, monitoring];
    }
    if (tv && current.monitor === 'skip') {
      const picked = [...current.seasons].sort((a, b) => a - b);
      const empty = picked.length === 0;
      const text = empty ? 'Choose seasons' : picked.map((seasonNumber) => (seasonNumber === 0 ? 'Specials' : String(seasonNumber))).join(', ');
      const seasonNumbers = subject.type === 'tv' ? subject.detail.seasons.map((season) => season.seasonNumber).sort((a, b) => a - b) : [];
      monitoring.push(
        <span key="monitor">{withMark(monitorChip, ':')}</span>,
        <DropdownMenu key="seasons">
          <DropdownMenuTrigger className={inlineTriggerClass(empty)} disabled={adding} aria-label={`Seasons: ${text}`}>
            <span className="min-w-0 truncate">{text}</span>
            {empty ? <Plus aria-hidden="true" /> : <ChevronDown aria-hidden="true" className="group-data-popup-open:rotate-180" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {seasonNumbers.map((seasonNumber) => (
              <DropdownMenuCheckboxItem
                key={seasonNumber}
                closeOnClick={false}
                checked={current.seasons.includes(seasonNumber)}
                onCheckedChange={(checked) => update({
                  seasons: checked ? [...current.seasons, seasonNumber] : current.seasons.filter((value) => value !== seasonNumber),
                })}
              >
                {seasonName(seasonNumber)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>,
      );
    } else {
      monitoring.push(<span key="monitor">{monitorChip}</span>);
    }
    const profileName = options.qualityProfiles.find((profile) => profile.id === current.qualityProfileId)?.name ?? '';
    const profileChip = (
      <Select value={String(current.qualityProfileId)} onValueChange={(value) => update({ qualityProfileId: Number(value) })} disabled={adding}>
        <Tooltip text={profileName}>
          <SelectTrigger variant="inline" className="max-w-80" aria-label={`Quality profile: ${profileName}`}>{profileName}</SelectTrigger>
        </Tooltip>
        <SelectContent>
          {options.qualityProfiles.map((profile) => <SelectItem key={profile.id} value={String(profile.id)}>{profile.name}</SelectItem>)}
        </SelectContent>
      </Select>
    );
    monitoring.push('using profile', <span key="profile">{withMark(profileChip, '.')}</span>);
    const lines = (...search: ReactNode[]) => (search.length === 0 ? [intro, monitoring] : [intro, monitoring, search]);

    if (tv) {
      const seasons = airing?.seasons ?? null;
      const aired = (keep: (seasonNumber: number) => boolean) => (seasons === null ? null : seasons.filter((season) => keep(season.seasonNumber)).reduce((sum, season) => sum + season.aired, 0));
      const newest = seasons === null ? undefined : seasons.filter((season) => season.seasonNumber > 0).sort((a, b) => b.seasonNumber - a.seasonNumber)[0];
      const count = current.monitor === 'all' ? aired((seasonNumber) => seasonNumber > 0)
        : current.monitor === 'lastSeason' ? (newest === undefined ? null : newest.aired)
          : current.monitor === 'skip' ? aired((seasonNumber) => current.seasons.includes(seasonNumber))
            : null;
      const nextAirDate = airing?.nextAirDate ?? null;
      if (current.monitor === 'future') {
        return nextAirDate === null ? lines() : lines('The next episode airs on', <span key="date">{withMark(pill(airDate(nextAirDate)), '.')}</span>);
      }
      if (count !== null && count > 0) {
        return lines(<span key="count">{pill(count)}</span>, `aired episode${count === 1 ? '' : 's'} will be included in the search.`);
      }
      if (current.monitor === 'all' && count === 0) {
        return nextAirDate === null
          ? lines('Nothing has aired yet.')
          : lines('Nothing has aired yet.', 'The first episode airs on', <span key="date">{withMark(pill(airDate(nextAirDate)), '.')}</span>);
      }
      return lines();
    }

    const availabilityLabel = labelOf(availabilityLabels, current.minimumAvailability);
    const availabilityChip = (
      <Select value={current.minimumAvailability} onValueChange={(value) => update({ minimumAvailability: String(value) })} disabled={adding}>
        <SelectTrigger variant="inline" aria-label={`Minimum availability: ${availabilityLabel}`}>{availabilityLabel}</SelectTrigger>
        <SelectContent>
          {availabilityLabels.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
    const onceAvailable = (lead: string) => [lead, <span key="availability">{withMark(availabilityChip, '.')}</span>];
    if (current.monitor === 'movieOnly') {
      if (detail.status === 'released') return lines('Search starts now.');
      const dates = subject.type === 'movie' ? subject.detail.releaseDates : null;
      const earliest = [dates?.digital ?? null, dates?.physical ?? null].filter((value): value is string => value !== null).sort()[0] ?? null;
      const expected = current.minimumAvailability === 'inCinemas' ? dates?.inCinemas ?? null
        : current.minimumAvailability === 'released' ? earliest
          : null;
      return expected !== null && expected.slice(0, 10) > new Date().toISOString().slice(0, 10)
        ? lines("Search starts once it's", <span key="availability">{withMark(availabilityChip, ',')}</span>, 'expected on', <span key="date">{withMark(pill(airDate(expected)), '.')}</span>)
        : lines(...onceAvailable("Search starts once it's"));
    }
    if (collection === undefined || collection === null) {
      return lines("Search covers the collection's films", ...onceAvailable("once they're"));
    }
    const films = `film${collection.films === 1 ? '' : 's'}`;
    return collection.allReleased
      ? lines('Search covers up to', <span key="count">{pill(collection.films)}</span>, `${films} now.`)
      : lines('Search covers up to', <span key="count">{pill(collection.films)}</span>, films, ...onceAvailable("once they're"));
  };

  const body = () => {
    if (load.kind === 'loading') return <StatusInline status="busy">Loading {serviceName}'s add options…</StatusInline>;
    if (load.kind === 'failed' || choices === undefined) return <Callout title={load.kind === 'failed' ? load.message : `${serviceName}'s add options didn't load.`} />;
    const { rootFolders } = load.options;
    const summary = tv
      ? `${choices.rootFolderPath} · ${labelOf(seriesTypeLabels, choices.seriesType)} · Season folders ${onOff(choices.seasonFolder)} · Monitor new seasons ${onOff(choices.monitorNewSeasons)}`
      : choices.rootFolderPath;
    return (
      <>
        <div className="flex w-fit max-w-full flex-col gap-3.5 rounded-2xl border-[1.5px] border-input px-8 py-7">
          {sentence(load.options, choices).map((line, lineIndex) => (
            <p key={lineIndex} className="flex flex-wrap items-center gap-x-2 gap-y-2 font-ui text-[22px] text-foreground">
              {line.map((part, index) => (typeof part === 'string' ? <span key={`text-${index}`}>{part}</span> : part))}
            </p>
          ))}
        </div>
        {seasonsMissing && <p className="font-ui text-sm text-warning">Choose at least one season to add this show.</p>}
        <Collapsible open={more} onOpenChange={setMore}>
          <CollapsibleTrigger className="px-0" summary={summary}>More options</CollapsibleTrigger>
          <CollapsiblePrimitive.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-all duration-(--duration-size) ease-out data-ending-style:h-0 data-ending-style:duration-(--duration-fast) data-ending-style:ease-in data-starting-style:h-0 motion-reduce:transition-none">
            <dl className="flex flex-col pt-2">
              <FactRow label="Root folder">
                <FixedWidthSelect
                  label="Root folder"
                  value={choices.rootFolderPath}
                  labels={rootFolders.map((folder) => [folder.path, folder.path])}
                  disabled={adding}
                  onChange={(rootFolderPath) => update({ rootFolderPath })}
                />
              </FactRow>
              {tv && (
                <>
                  <FactRow label="Series type">
                    <FixedWidthSelect
                      label="Series type"
                      value={choices.seriesType}
                      labels={seriesTypeLabels}
                      disabled={adding}
                      onChange={(seriesType) => update({ seriesType: seriesType as SeriesType })}
                    />
                  </FactRow>
                  <FactRow label="Season folders">
                    <FixedWidthSelect
                      label="Season folders"
                      value={choices.seasonFolder ? 'on' : 'off'}
                      labels={onOffLabels}
                      disabled={adding}
                      onChange={(value) => update({ seasonFolder: value === 'on' })}
                    />
                  </FactRow>
                  <FactRow label="Monitor new seasons">
                    <FixedWidthSelect
                      label="Monitor new seasons"
                      value={choices.monitorNewSeasons ? 'on' : 'off'}
                      labels={onOffLabels}
                      disabled={adding}
                      onChange={(value) => update({ monitorNewSeasons: value === 'on' })}
                    />
                  </FactRow>
                </>
              )}
            </dl>
          </CollapsiblePrimitive.Panel>
        </Collapsible>
      </>
    );
  };

  // A write in flight blocks every way out (Esc, scrim, Close, Cancel): the server does not deduplicate adds.
  const close = () => { if (!adding) setOpen(false); };

  return (
    <>
      <Button size="large" icon={<Plus />} onClick={() => { setAdd({ kind: 'editing' }); setOpen(true); }}>Add to library</Button>
      <Dialog
        wide
        open={open}
        onOpenChange={(next) => { if (!next) close(); }}
        title={<>Add <span className="font-extrabold">{detail.title}</span></>}
        closeLabel="Close"
        footerCallout={add.kind === 'refused' ? <Callout title={add.message} /> : undefined}
        actions={(
          <>
            <Button variant="ghost" size="large" disabled={adding} onClick={close}>Cancel</Button>
            <Button
              size="large"
              icon={<Check />}
              loading={add.kind === 'adding'}
              disabled={load.kind !== 'ready' || choices === undefined || seasonsMissing || adding}
              onClick={() => void submit()}
            >
              Confirm selection
            </Button>
          </>
        )}
      >
        {body()}
      </Dialog>
    </>
  );
}
