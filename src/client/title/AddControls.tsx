import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BlockAddControls } from '@/components/ui/block-add-controls';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible-trigger';
import { SelectContent, SelectItem } from '@/components/ui/dropdown-menu';
import { OptionRow } from '@/components/ui/option-row';
import { Select, SelectTrigger } from '@/components/ui/select-trigger';
import { StatusInline } from '@/components/ui/status-inline';
import { useToastManager } from '@/components/ui/toast';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { SearchResult } from '../Search';

type QualityProfile = { id: number; name: string };
type RootFolder = { path: string; freeSpace: number | null };

type SeriesChoices = {
  monitor: string;
  monitorNewSeasons: boolean;
  qualityProfileId: number;
  rootFolderPath: string;
  seasonFolder: boolean;
  seriesType: 'standard' | 'daily' | 'anime';
  searchOnAdd: boolean;
};

type MovieChoices = {
  monitor: string;
  minimumAvailability: string;
  qualityProfileId: number;
  rootFolderPath: string;
  searchOnAdd: boolean;
};

type Options = { qualityProfiles: QualityProfile[]; rootFolders: RootFolder[]; defaults: SeriesChoices | MovieChoices | null };

type LoadState =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; options: Options };

type AddState =
  | { kind: 'editing' }
  | { kind: 'adding' }
  | { kind: 'refused'; message: string }
  | { kind: 'added'; searched: boolean };

// Labels follow Sonarr's and Radarr's add screens so the owner sees the words they already know.
const seriesMonitorLabels: Array<[string, string]> = [
  ['all', 'All episodes'],
  ['future', 'Future episodes'],
  ['missing', 'Missing episodes'],
  ['existing', 'Existing episodes'],
  ['recent', 'Recent episodes'],
  ['pilot', 'Pilot episode'],
  ['firstSeason', 'First season'],
  ['lastSeason', 'Last season'],
  ['monitorSpecials', 'Monitor specials'],
  ['unmonitorSpecials', 'Unmonitor specials'],
  ['none', 'None'],
];
const movieMonitorLabels: Array<[string, string]> = [
  ['movieOnly', 'Movie only'],
  ['movieAndCollection', 'Movie and collection'],
  ['none', 'None'],
];
const availabilityLabels: Array<[string, string]> = [
  ['announced', 'Announced'],
  ['inCinemas', 'In cinemas'],
  ['released', 'Released'],
];

const failureMessage = (service: 'Sonarr' | 'Radarr', error: unknown, fallback: string) => {
  if (error === 'not_configured') return `${service} isn't connected yet.`;
  if (error === 'rejected') return `${service} refused the API key.`;
  if (error === 'unreachable') return `${service} didn't answer.`;
  if (error === 'not_found') return `${service} no longer finds this title.`;
  return fallback;
};

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

const seriesTypeLabels: Array<[SeriesChoices['seriesType'], string]> = [['standard', 'Standard'], ['daily', 'Daily'], ['anime', 'Anime']];

// The first three monitor choices sit in the toggle group; the rest open from "More".
const FIRST_CHOICES = 3;

const labelOf = (labels: Array<[string, string]>, value: string) => labels.find(([key]) => key === value)?.[1] ?? value;

// A Select whose trigger shows the chosen label after a grey lead word.
function ChoiceSelect({ lead, value, labels, disabled, onChange }: {
  lead: string;
  value: string;
  labels: Array<[string, string]>;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(String(next))} disabled={disabled}>
      <SelectTrigger lead={lead}>{labelOf(labels, value)}</SelectTrigger>
      <SelectContent>
        {labels.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function AddControls({ result, onAdded, onUnauthenticated }: {
  result: Pick<SearchResult, 'type' | 'tvdbId' | 'tmdbId'>;
  onAdded: (libraryId: number) => void;
  onUnauthenticated: () => void;
}) {
  const tv = result.type === 'tv';
  const serviceName = tv ? 'Sonarr' : 'Radarr';
  const toasts = useToastManager();
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [series, setSeries] = useState<SeriesChoices | undefined>(undefined);
  const [movie, setMovie] = useState<MovieChoices | undefined>(undefined);
  const [more, setMore] = useState(false);
  const [add, setAdd] = useState<AddState>({ kind: 'editing' });

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/add/options/${tv ? 'sonarr' : 'radarr'}`, {
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
        if (options.qualityProfiles.length === 0 || options.rootFolders.length === 0) {
          setLoad({ kind: 'failed', message: `${serviceName} has no quality profile or root folder to add into.` });
          return;
        }
        const qualityProfileId = options.qualityProfiles[0].id;
        const rootFolderPath = options.rootFolders[0].path;
        if (tv) {
          setSeries((options.defaults as SeriesChoices | null) ?? {
            monitor: 'all', monitorNewSeasons: true, qualityProfileId, rootFolderPath, seasonFolder: true, seriesType: 'standard', searchOnAdd: true,
          });
        } else {
          setMovie((options.defaults as MovieChoices | null) ?? {
            monitor: 'movieOnly', minimumAvailability: 'released', qualityProfileId, rootFolderPath, searchOnAdd: true,
          });
        }
        setLoad({ kind: 'ready', options });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoad({ kind: 'failed', message: `${serviceName}'s add options didn't load.` });
      }
    })();
    return () => controller.abort();
  }, [tv, serviceName, onUnauthenticated]);

  const heading = `Add to ${serviceName}`;
  if (load.kind === 'loading') {
    return <BlockAddControls heading={heading} option={<StatusInline status="busy">Loading {serviceName}'s add options…</StatusInline>} />;
  }
  if (load.kind === 'failed') return <BlockAddControls heading={heading} callout={<Callout title={load.message} />} />;

  const { qualityProfiles, rootFolders } = load.options;
  const choices = tv ? series : movie;
  if (choices === undefined) return null;
  const searchOnAdd = choices.searchOnAdd;
  const busy = add.kind === 'adding' || add.kind === 'added';
  const update = (patch: Partial<SeriesChoices & MovieChoices>) => {
    if (tv) setSeries({ ...series!, ...patch });
    else setMovie({ ...movie!, ...patch });
  };

  const submit = async (search: boolean) => {
    setAdd({ kind: 'adding' });
    try {
      const response = await postJson('/api/add', {
        service: tv ? 'sonarr' : 'radarr',
        id: tv ? result.tvdbId : result.tmdbId,
        choices: { ...choices, searchOnAdd: search },
      });
      if (response.status === 401) {
        onUnauthenticated();
        return;
      }
      const body = await readBody(response);
      if (response.status === 201 && typeof body.libraryId === 'number') {
        setAdd({ kind: 'added', searched: search });
        toasts.add({
          title: `Added to ${serviceName}`,
          description: search
            ? tv ? 'Sonarr is searching for the monitored episodes that have aired.' : 'Radarr is searching for the movie.'
            : 'No search was started.',
        });
        onAdded(body.libraryId);
        return;
      }
      setAdd({
        kind: 'refused',
        message: body.error === 'refused' && typeof body.reason === 'string'
          ? `${serviceName} refused: ${body.reason}`
          : failureMessage(serviceName, body.error, `${serviceName} didn't add it.`),
      });
    } catch {
      setAdd({ kind: 'refused', message: "The add didn't reach media-manager-2's server." });
    }
  };

  const monitorLabels = tv ? seriesMonitorLabels : movieMonitorLabels;
  const firstChoices = monitorLabels.slice(0, FIRST_CHOICES);
  const restChoices = monitorLabels.slice(FIRST_CHOICES);
  const inRest = restChoices.some(([key]) => key === choices.monitor);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit(searchOnAdd);
      }}
    >
      <BlockAddControls
        heading={heading}
        monitorLabel="Monitor"
        monitor={(
          <>
            <ToggleGroup aria-label="Monitor" value={choices.monitor} onValueChange={(monitor) => update({ monitor })} disabled={busy}>
              {firstChoices.map(([key, label]) => <ToggleGroupItem key={key} value={key}>{label}</ToggleGroupItem>)}
            </ToggleGroup>
            {restChoices.length > 0 && (
              <Select value={choices.monitor} onValueChange={(monitor) => update({ monitor: String(monitor) })} disabled={busy}>
                <SelectTrigger aria-label="More monitor choices">{inRest ? labelOf(monitorLabels, choices.monitor) : 'More'}</SelectTrigger>
                <SelectContent>
                  {restChoices.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </>
        )}
        selects={(
          <>
            <ChoiceSelect
              lead="Quality"
              value={String(choices.qualityProfileId)}
              labels={qualityProfiles.map((profile) => [String(profile.id), profile.name])}
              disabled={busy}
              onChange={(value) => update({ qualityProfileId: Number(value) })}
            />
            {!tv && movie !== undefined && (
              <ChoiceSelect
                lead="Available when"
                value={movie.minimumAvailability}
                labels={availabilityLabels}
                disabled={busy}
                onChange={(minimumAvailability) => update({ minimumAvailability })}
              />
            )}
          </>
        )}
        option={(
          <>
            <OptionRow
              control={<Checkbox checked={searchOnAdd} disabled={busy} onCheckedChange={(checked) => update({ searchOnAdd: checked })} />}
              title="Search on add"
              description={tv ? 'Start the automatic search for every monitored episode that has aired.' : 'Search for the movie as soon as it is added.'}
            />
            <Collapsible open={more} onOpenChange={setMore}>
              <CollapsibleTrigger className="px-0">More options</CollapsibleTrigger>
              <CollapsiblePrimitive.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-all duration-(--duration-size) ease-out data-ending-style:h-0 data-ending-style:duration-(--duration-fast) data-ending-style:ease-in data-starting-style:h-0 motion-reduce:transition-none">
                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex gap-3">
                    <ChoiceSelect
                      lead="Root folder"
                      value={choices.rootFolderPath}
                      labels={rootFolders.map((folder) => [folder.path, folder.path])}
                      disabled={busy}
                      onChange={(rootFolderPath) => update({ rootFolderPath })}
                    />
                    {tv && series !== undefined && (
                      <ChoiceSelect
                        lead="Series type"
                        value={series.seriesType}
                        labels={seriesTypeLabels}
                        disabled={busy}
                        onChange={(seriesType) => update({ seriesType: seriesType as SeriesChoices['seriesType'] })}
                      />
                    )}
                  </div>
                  {tv && series !== undefined && (
                    <>
                      <OptionRow
                        className="px-0"
                        control={<Checkbox checked={series.seasonFolder} disabled={busy} onCheckedChange={(seasonFolder) => update({ seasonFolder })} />}
                        title="Season folders"
                      />
                      <OptionRow
                        className="px-0"
                        control={<Checkbox checked={series.monitorNewSeasons} disabled={busy} onCheckedChange={(monitorNewSeasons) => update({ monitorNewSeasons })} />}
                        title="Monitor new seasons"
                      />
                    </>
                  )}
                </div>
              </CollapsiblePrimitive.Panel>
            </Collapsible>
          </>
        )}
        callout={add.kind === 'refused' ? <Callout title={add.message} /> : undefined}
        primary={(
          <Button type="submit" size="large" icon={<Plus />} loading={add.kind === 'adding'} disabled={add.kind === 'added'}>
            {add.kind === 'adding' ? 'Adding…' : searchOnAdd ? 'Add and search' : 'Add'}
          </Button>
        )}
        secondary={searchOnAdd && <Button variant="outline" disabled={busy} onClick={() => void submit(false)}>Add without searching</Button>}
      />
    </form>
  );
}
