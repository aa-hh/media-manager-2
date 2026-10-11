import { useEffect, useState, type ReactNode } from 'react';
import { Button } from './components/ui/button';
import { OwnedTitle } from './Owned';
import { Chip, Poster, statusLabel, type SearchResult } from './Search';

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

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-[var(--secondary-ink)]">{label}</label>
      {children}
    </div>
  );
}

const selectClass = 'h-9 rounded-md border border-[var(--border)] bg-[var(--control)] px-2 text-sm text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--focus)]';

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-[var(--ink)]">
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-[var(--ink)]" />
      {label}
    </label>
  );
}

export function AddControls({ result, onAdded, onUnauthenticated }: {
  result: SearchResult;
  onAdded: (libraryId: number) => void;
  onUnauthenticated: () => void;
}) {
  const tv = result.type === 'tv';
  const serviceName = tv ? 'Sonarr' : 'Radarr';
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

  if (add.kind === 'added') {
    return (
      <p role="status" className="text-[var(--ink)]">
        Added to {serviceName}.{' '}
        {add.searched
          ? tv ? 'Sonarr is searching for the monitored episodes that have aired.' : 'Radarr is searching for the movie.'
          : 'No search was started.'}
      </p>
    );
  }
  if (load.kind === 'loading') return <p className="text-[var(--secondary-ink)]">Loading {serviceName}'s add options…</p>;
  if (load.kind === 'failed') return <p role="alert" className="text-[#b42318]">{load.message}</p>;

  const { qualityProfiles, rootFolders } = load.options;
  const choices = tv ? series : movie;
  if (choices === undefined) return null;
  const searchOnAdd = choices.searchOnAdd;

  const submit = async () => {
    setAdd({ kind: 'adding' });
    try {
      const response = await postJson('/api/add', {
        service: tv ? 'sonarr' : 'radarr',
        id: tv ? result.tvdbId : result.tmdbId,
        choices,
      });
      if (response.status === 401) {
        onUnauthenticated();
        return;
      }
      const body = await readBody(response);
      if (response.status === 201 && typeof body.libraryId === 'number') {
        setAdd({ kind: 'added', searched: searchOnAdd });
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

  const profileSelect = (
    <Field label="Quality profile" htmlFor="add-profile">
      <select
        id="add-profile"
        className={selectClass}
        value={choices.qualityProfileId}
        onChange={(event) => {
          const qualityProfileId = Number(event.target.value);
          if (tv) setSeries({ ...series!, qualityProfileId });
          else setMovie({ ...movie!, qualityProfileId });
        }}
      >
        {qualityProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
      </select>
    </Field>
  );

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="flex flex-wrap gap-4">
        {tv && series !== undefined && (
          <Field label="Monitor" htmlFor="add-monitor">
            <select id="add-monitor" className={selectClass} value={series.monitor} onChange={(event) => setSeries({ ...series, monitor: event.target.value })}>
              {seriesMonitorLabels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
        )}
        {!tv && movie !== undefined && (
          <>
            <Field label="Monitor" htmlFor="add-monitor">
              <select id="add-monitor" className={selectClass} value={movie.monitor} onChange={(event) => setMovie({ ...movie, monitor: event.target.value })}>
                {movieMonitorLabels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Minimum availability" htmlFor="add-availability">
              <select id="add-availability" className={selectClass} value={movie.minimumAvailability} onChange={(event) => setMovie({ ...movie, minimumAvailability: event.target.value })}>
                {availabilityLabels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
          </>
        )}
        {profileSelect}
      </div>

      <Toggle
        id="add-search"
        label={tv ? 'Start search for missing episodes' : 'Start search for missing movie'}
        checked={searchOnAdd}
        onChange={(value) => (tv ? setSeries({ ...series!, searchOnAdd: value }) : setMovie({ ...movie!, searchOnAdd: value }))}
      />

      <div>
        <button
          type="button"
          aria-expanded={more}
          onClick={() => setMore(!more)}
          className="text-sm font-medium text-[var(--secondary-ink)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
        >
          {more ? 'Fewer options' : 'More options'}
        </button>
        {more && (
          <div className="mt-4 flex max-w-sm flex-col gap-4">
            <Field label="Root folder" htmlFor="add-root">
              <select
                id="add-root"
                className={selectClass}
                value={choices.rootFolderPath}
                onChange={(event) => {
                  const rootFolderPath = event.target.value;
                  if (tv) setSeries({ ...series!, rootFolderPath });
                  else setMovie({ ...movie!, rootFolderPath });
                }}
              >
                {rootFolders.map((folder) => <option key={folder.path} value={folder.path}>{folder.path}</option>)}
              </select>
            </Field>
            {tv && series !== undefined && (
              <>
                <Field label="Series type" htmlFor="add-type">
                  <select id="add-type" className={selectClass} value={series.seriesType} onChange={(event) => setSeries({ ...series, seriesType: event.target.value as SeriesChoices['seriesType'] })}>
                    <option value="standard">Standard</option>
                    <option value="daily">Daily</option>
                    <option value="anime">Anime</option>
                  </select>
                </Field>
                <Toggle id="add-season-folder" label="Season folders" checked={series.seasonFolder} onChange={(seasonFolder) => setSeries({ ...series, seasonFolder })} />
                <Toggle id="add-new-seasons" label="Monitor new seasons" checked={series.monitorNewSeasons} onChange={(monitorNewSeasons) => setSeries({ ...series, monitorNewSeasons })} />
              </>
            )}
          </div>
        )}
      </div>

      {add.kind === 'refused' && <p role="alert" className="text-[#b42318]">{add.message}</p>}
      <div>
        <Button type="submit" disabled={add.kind === 'adding'} className="min-h-10 bg-[var(--ink)] text-[var(--control)] hover:bg-[var(--ink)]/90">
          {add.kind === 'adding' ? 'Adding…' : searchOnAdd ? 'Add and search' : 'Add'}
        </Button>
      </div>
    </form>
  );
}

export function TitleView({ result, onBack, onAdded, onUnauthenticated }: {
  result: SearchResult;
  onBack: () => void;
  onAdded: (libraryId: number) => void;
  onUnauthenticated: () => void;
}) {
  const status = statusLabel(result.status);
  const [justAdded, setJustAdded] = useState(false);
  return (
    <article className="px-4 pb-16 pt-6 sm:px-6">
      <button type="button" onClick={onBack} className="text-sm font-medium text-[var(--secondary-ink)] hover:text-[var(--ink)]">
        ← Search results
      </button>
      <div className="mt-5 flex flex-col gap-6 sm:flex-row">
        <Poster url={result.posterUrl} className="h-60 w-40 rounded" />
        <div className="min-w-0 max-w-2xl flex-1">
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
            {result.title}
            {result.year !== null && <span className="ml-2 font-normal tabular-nums text-[var(--secondary-ink)]">{result.year}</span>}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Chip>{result.type === 'tv' ? 'TV' : 'Movie'}</Chip>
            {result.network !== null && <span className="text-sm text-[var(--secondary-ink)]">{result.network}</span>}
            {status !== null && <Chip>{status}</Chip>}
            {result.rating !== null && <Chip>{`${result.rating.toFixed(1)} ★`}</Chip>}
            {result.inLibrary && <Chip tone="filled">✓ In library</Chip>}
          </div>
          {result.overview !== null && <p className="mt-4 line-clamp-3 text-[var(--secondary-ink)]">{result.overview}</p>}
          {!(result.inLibrary && !justAdded) && (
            <div className="mt-6">
              <AddControls
                result={result}
                onAdded={(libraryId) => {
                  setJustAdded(true);
                  onAdded(libraryId);
                }}
                onUnauthenticated={onUnauthenticated}
              />
            </div>
          )}
        </div>
      </div>
      {result.inLibrary && !justAdded && (
        <div className="mt-6">
          <OwnedTitle result={result} onUnauthenticated={onUnauthenticated} />
        </div>
      )}
    </article>
  );
}
