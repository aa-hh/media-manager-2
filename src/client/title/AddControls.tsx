import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { ToastNumber, useToastManager } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getJson, postJson } from '../library/api';
import { addedToast, airDate, availabilityLabels, labelOf, searchFact, type Airing, type CollectionSize, type SearchFact } from './addText';
import type { Subject } from './TitleHeader';

type QualityProfile = { id: number; name: string };
type RootFolder = { path: string; freeSpace: number | null };
type Options = { qualityProfiles: QualityProfile[]; rootFolders: RootFolder[]; lastChoice: { qualityProfileId: number; rootFolderPath: string } | null };

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
  | { kind: 'refused'; title: string; body?: string; libraryId?: number }
  | { kind: 'added' };


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
const seriesTypeLabels: Array<[string, string]> = [['standard', 'Standard'], ['daily', 'Daily'], ['anime', 'Anime']];
const onOffLabels: Array<[string, string]> = [['on', 'On'], ['off', 'Off']];

const seasonName = (seasonNumber: number) => (seasonNumber === 0 ? 'Specials' : `Season ${seasonNumber}`);

const failureMessage = (service: 'Sonarr' | 'Radarr', error: unknown, fallback: string) => {
  if (error === 'not_configured') return `${service} isn't connected. Add it in Settings.`;
  if (error === 'rejected') return `${service} refused the API key. Check the key in Settings.`;
  if (error === 'unreachable') return `${service} didn't answer. Check it's running, then try again.`;
  if (error === 'not_found') return service === 'Sonarr' ? "Sonarr can't find this show on TheTVDB." : "Radarr can't find this movie on TMDB.";
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
  const [attempt, setAttempt] = useState(0);
  // Counts the owner's monitor and season changes only, so line 3 replays its fade on those and never on data arriving.
  const [searchChange, setSearchChange] = useState(0);
  const factPill = useRef<HTMLSpanElement>(null);
  const inFlight = useRef(false);
  const kinds = tv ? 'shows' : 'movies';
  const loadFailed = `Couldn't load ${serviceName}'s quality profiles and root folders.`;

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ kind: 'loading' });
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
          setLoad({ kind: 'failed', message: failureMessage(serviceName, body.error, loadFailed) });
          return;
        }
        const options = body as unknown as Options;
        if (options.qualityProfiles.length === 0) {
          setLoad({ kind: 'failed', message: `${serviceName} has no quality profile. Create one in ${serviceName} to add ${kinds}.` });
          return;
        }
        if (options.rootFolders.length === 0) {
          setLoad({ kind: 'failed', message: `${serviceName} has no root folder. Add one in ${serviceName} to add ${kinds}.` });
          return;
        }
        // The last successful add's profile and folder, when the service still has them.
        const last = options.lastChoice;
        setChoices({
          monitor: tv ? 'all' : 'movieOnly',
          qualityProfileId: options.qualityProfiles.find((profile) => profile.id === last?.qualityProfileId)?.id ?? options.qualityProfiles[0].id,
          rootFolderPath: options.rootFolders.find((folder) => folder.path === last?.rootFolderPath)?.path ?? options.rootFolders[0].path,
          minimumAvailability: 'released',
          seriesType: 'standard',
          seasonFolder: true,
          monitorNewSeasons: true,
          seasons: [],
        });
        setLoad({ kind: 'ready', options });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoad({ kind: 'failed', message: loadFailed });
      }
    })();
    return () => controller.abort();
  }, [tv, service, serviceName, kinds, loadFailed, onUnauthenticated, attempt]);

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

  // What the search covers for these choices. The sentence's third line and the toast both word it.
  const fact = choices === undefined ? undefined : searchFact(choices, { tv, airing, collection, movie: subject.type === 'movie' ? subject.detail : null });

  // The server does not deduplicate adds, so a second Enter or click while one is out is dropped.
  const submit = async () => {
    if (choices === undefined || fact === undefined || inFlight.current || add.kind === 'added') return;
    inFlight.current = true;
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
        const libraryId = body.libraryId;
        // The line-3 pill's last place in the closing dialog, where the toast's number starts its travel.
        const pillRect = factPill.current?.getBoundingClientRect();
        const from = pillRect === undefined ? undefined : { left: pillRect.left, top: pillRect.top, width: pillRect.width, height: pillRect.height };
        setAdd({ kind: 'added' });
        setOpen(false);
        const toast = addedToast(serviceName, detail.title, fact);
        toasts.add({
          title: toast.title,
          description: <>{toast.before}{toast.number !== null && <ToastNumber from={from}>{toast.number}</ToastNumber>}{toast.after}</>,
        });
        // 120 matches --duration-fast in globals.css, so the dialog's exit plays before navigation unmounts it.
        window.setTimeout(() => onAdded(libraryId), 120);
        return;
      }
      if (response.status === 409 && body.error === 'refused' && typeof body.reason === 'string') {
        setAdd({
          kind: 'refused',
          title: `${serviceName} refused to add ${detail.title}.`,
          body: `${body.reason} Nothing was added.`,
          ...(typeof body.libraryId === 'number' ? { libraryId: body.libraryId } : {}),
        });
        return;
      }
      setAdd({ kind: 'refused', title: failureMessage(serviceName, body.error, `${serviceName} didn't add it.`), body: 'Nothing was added.' });
    } catch {
      setAdd({ kind: 'refused', title: "Lost contact with media-manager-2's server. The add may have gone through, so check the library before trying again." });
    } finally {
      inFlight.current = false;
    }
  };

  // Three lines, one fact each: who adds it, what gets monitored, and what the search covers. A line with nothing to say is left out.
  const sentence = (options: Options, current: Choices, fact: SearchFact): ReactNode[][] => {
    const monitorLabels = tv ? seriesMonitorLabels : movieMonitorLabels.filter(([key]) => key !== 'movieAndCollection' || subject.type !== 'movie' || subject.detail.collection !== null);
    const monitorLabel = labelOf(monitorLabels, current.monitor);
    const monitorChip = (
      <Select key="monitor" value={current.monitor} onValueChange={(monitor) => { update({ monitor: String(monitor) }); setSearchChange((value) => value + 1); }} disabled={adding}>
        <SelectTrigger variant="inline" aria-label={monitorLabel}>{monitorLabel}</SelectTrigger>
        <SelectContent>
          {monitorLabels.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
    // Every number or date pill sits on line 3: it flashes with the line's fade and hands off to the toast on Confirm.
    const pill = (value: ReactNode) => (
      <Badge ref={factPill} variant="inline-value" className={cn(searchChange > 0 && 'animate-pill-flash', add.kind === 'added' && 'invisible')}>{value}</Badge>
    );

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
          <DropdownMenuTrigger className={inlineTriggerClass(empty)} disabled={adding} aria-label={text}>
            <span className="min-w-0 truncate">{text}</span>
            {empty ? <Plus aria-hidden="true" /> : <ChevronDown aria-hidden="true" className="group-data-popup-open:rotate-180" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {seasonNumbers.map((seasonNumber) => (
              <DropdownMenuCheckboxItem
                key={seasonNumber}
                closeOnClick={false}
                checked={current.seasons.includes(seasonNumber)}
                onCheckedChange={(checked) => {
                  update({ seasons: checked ? [...current.seasons, seasonNumber] : current.seasons.filter((value) => value !== seasonNumber) });
                  setSearchChange((value) => value + 1);
                }}
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
          <SelectTrigger variant="inline" className="max-w-80" aria-label={profileName}>{profileName}</SelectTrigger>
        </Tooltip>
        <SelectContent>
          {options.qualityProfiles.map((profile) => <SelectItem key={profile.id} value={String(profile.id)}>{profile.name}</SelectItem>)}
        </SelectContent>
      </Select>
    );
    monitoring.push('using profile', <span key="profile">{withMark(profileChip, '.')}</span>);
    const lines = (...search: ReactNode[]) => (search.length === 0 ? [intro, monitoring] : [intro, monitoring, search]);

    if (fact.kind === 'future') {
      return fact.nextAirDate === null ? lines() : lines('The next episode airs on', <span key="date">{withMark(pill(airDate(fact.nextAirDate)), '.')}</span>);
    }
    if (fact.kind === 'aired') {
      return lines(<span key="count">{pill(fact.count)}</span>, `aired episode${fact.count === 1 ? '' : 's'} will be included in the search.`);
    }
    if (fact.kind === 'nothingAired') {
      return fact.firstAirDate === null
        ? lines('Nothing has aired yet.')
        : lines('Nothing has aired yet.', 'The first episode airs on', <span key="date">{withMark(pill(airDate(fact.firstAirDate)), '.')}</span>);
    }
    if (fact.kind === 'none' || fact.kind === 'unknown') return lines();

    const availabilityLabel = labelOf(availabilityLabels, current.minimumAvailability);
    const availabilityChip = (
      <Select value={current.minimumAvailability} onValueChange={(value) => update({ minimumAvailability: String(value) })} disabled={adding}>
        <SelectTrigger variant="inline" aria-label={availabilityLabel}>{availabilityLabel}</SelectTrigger>
        <SelectContent>
          {availabilityLabels.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
    const onceAvailable = (lead: string) => [lead, <span key="availability">{withMark(availabilityChip, '.')}</span>];
    if (fact.kind === 'now') return lines('Search starts now.');
    if (fact.kind === 'expected') {
      return fact.date !== null
        ? lines("Search starts once it's", <span key="availability">{withMark(availabilityChip, ',')}</span>, 'expected on', <span key="date">{withMark(pill(airDate(fact.date)), '.')}</span>)
        : lines(...onceAvailable("Search starts once it's"));
    }
    if (fact.movies === null) {
      return lines("Search covers the collection's movies", ...onceAvailable("once they're"));
    }
    const movies = `movie${fact.movies === 1 ? '' : 's'}`;
    return fact.allReleased
      ? lines('Search covers up to', <span key="count">{pill(fact.movies)}</span>, `${movies} now.`)
      : lines('Search covers up to', <span key="count">{pill(fact.movies)}</span>, movies, ...onceAvailable("once they're"));
  };

  const body = () => {
    if (load.kind === 'loading') return <StatusInline status="busy">Loading {serviceName}'s add options…</StatusInline>;
    if (load.kind === 'failed' || choices === undefined || fact === undefined) {
      return (
        <Callout
          title={load.kind === 'failed' ? load.message : loadFailed}
          action={<Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>Try again</Button>}
        />
      );
    }
    const { rootFolders } = load.options;
    return (
      <>
        <div className="flex w-full flex-col gap-3.5 rounded-2xl border-[1.5px] border-input px-8 py-7">
          {sentence(load.options, choices, fact).map((line, lineIndex) => (
            <p
              key={lineIndex === 2 ? `search-${searchChange}` : lineIndex}
              className={cn('flex flex-wrap items-center gap-x-2 gap-y-2 font-ui text-[22px] leading-[1.3] text-foreground', lineIndex === 2 && searchChange > 0 && 'animate-content-in')}
            >
              {line.map((part, index) => (typeof part === 'string' ? <span key={`text-${index}`}>{part}</span> : part))}
            </p>
          ))}
        </div>
        {seasonsMissing && <p className="font-ui text-sm text-warning">Choose at least one season to add this show.</p>}
        {/* v2/Block/add-controls — ~/Projects/media-manager-2-design/design-system.lib.pen RJNba: 28 from the sentence box, a 32-high trigger, rows 48 high with 180 labels. */}
        <Collapsible open={more} onOpenChange={setMore} className="mt-5">
          <CollapsibleTrigger className="h-8 px-0">More options</CollapsibleTrigger>
          <CollapsiblePrimitive.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-all duration-(--duration-size) ease-out data-ending-style:h-0 data-ending-style:duration-(--duration-fast) data-ending-style:ease-in data-starting-style:h-0 motion-reduce:transition-none">
            <dl className="flex flex-col pb-2 pl-6 [&_dt]:w-45 [&>div]:h-12">
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
  // A duplicate refusal that names the existing item swaps Confirm for a way to it.
  const existingId = add.kind === 'refused' ? add.libraryId : undefined;

  return (
    <>
      <Button size="large" icon={<Plus />} onClick={() => { setAdd({ kind: 'editing' }); setOpen(true); }}>Add to library</Button>
      <Dialog
        wide
        open={open}
        onOpenChange={(next) => { if (!next) close(); }}
        title={<>Add <span className="font-extrabold">{detail.title}</span></>}
        closeLabel="Close"
        footerCallout={add.kind === 'refused' ? <Callout title={add.title}>{add.body}</Callout> : undefined}
        actions={(
          <>
            <Button variant="ghost" size="large" disabled={adding} onClick={close}>Cancel</Button>
            {existingId !== undefined ? (
              <Button size="large" onClick={() => onAdded(existingId)}>Open in library</Button>
            ) : (
              <Button
                size="large"
                icon={<Check />}
                loading={add.kind === 'adding'}
                disabled={load.kind !== 'ready' || choices === undefined || seasonsMissing || adding}
                onClick={() => void submit()}
              >
                Confirm selection
              </Button>
            )}
          </>
        )}
      >
        {body()}
      </Dialog>
    </>
  );
}
