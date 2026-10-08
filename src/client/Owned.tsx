import { useEffect, useState } from 'react';
import { Button } from './components/ui/button';
import { PickRelease, type OwnedEpisode, type ReleaseTarget } from './PickRelease';
import type { SearchResult } from './Search';

type Load<T> = { kind: 'loading' } | { kind: 'failed'; message: string } | { kind: 'ready'; value: T };

const useOwned = <T,>(path: string, service: string, onUnauthenticated: () => void) => {
  const [state, setState] = useState<Load<T>>({ kind: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(path, { credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: controller.signal });
        if (response.status === 401) {
          onUnauthenticated();
          return;
        }
        if (!response.ok) {
          setState({ kind: 'failed', message: `${service} didn't answer.` });
          return;
        }
        setState({ kind: 'ready', value: await response.json() as T });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ kind: 'failed', message: "media-manager-2's server didn't answer." });
      }
    })();
    return () => controller.abort();
  }, [path, service, onUnauthenticated]);
  return state;
};

const sameTarget = (a: ReleaseTarget | undefined, b: ReleaseTarget) => a !== undefined && JSON.stringify(a) === JSON.stringify(b);

// A stand-in for the library overview (AA-30): just enough of an owned title to start Pick a release.
function OwnedMovie({ result, onUnauthenticated }: { result: SearchResult; onUnauthenticated: () => void }) {
  const movie = useOwned<{ hasFile: boolean }>(`/api/owned/movie/${result.libraryId}`, 'Radarr', onUnauthenticated);
  const [open, setOpen] = useState(false);
  if (movie.kind === 'loading') return <p className="text-[var(--secondary-ink)]">Loading…</p>;
  if (movie.kind === 'failed') return <p role="alert" className="text-[#b42318]">{movie.message}</p>;
  return (
    <div>
      <p className="text-[var(--secondary-ink)]">{movie.value.hasFile ? 'Downloaded.' : 'Missing.'}</p>
      {!open && <Button className="mt-3 min-h-9" onClick={() => setOpen(true)}>Pick a release</Button>}
      {open && (
        <PickRelease
          target={{ service: 'radarr', kind: 'movie', movieId: result.libraryId! }}
          title={result.title}
          episodes={[]}
          movieHasFile={movie.value.hasFile}
          onClose={() => setOpen(false)}
          onUnauthenticated={onUnauthenticated}
        />
      )}
    </div>
  );
}

function OwnedSeries({ result, onUnauthenticated }: { result: SearchResult; onUnauthenticated: () => void }) {
  const episodes = useOwned<OwnedEpisode[]>(`/api/owned/series/${result.libraryId}/episodes`, 'Sonarr', onUnauthenticated);
  const [season, setSeason] = useState<number | undefined>(undefined);
  const [picking, setPicking] = useState<ReleaseTarget | undefined>(undefined);
  if (episodes.kind === 'loading') return <p className="text-[var(--secondary-ink)]">Loading episodes…</p>;
  if (episodes.kind === 'failed') return <p role="alert" className="text-[#b42318]">{episodes.message}</p>;
  const all = episodes.value;
  const seasons = [...new Set(all.map((episode) => episode.seasonNumber))].sort((a, b) => b - a);
  const shown = season ?? seasons.find((number) => number > 0) ?? seasons[0];
  if (shown === undefined) return <p className="text-[var(--secondary-ink)]">Sonarr has no episodes for this show yet.</p>;
  const seriesId = result.libraryId!;
  const seasonTarget: ReleaseTarget = { service: 'sonarr', kind: 'season', seriesId, seasonNumber: shown };
  const picker = (target: ReleaseTarget, title: string) => (
    <PickRelease target={target} title={title} episodes={all} movieHasFile={false} onClose={() => setPicking(undefined)} onUnauthenticated={onUnauthenticated} />
  );
  return (
    <div className="-mx-4 sm:-mx-6">
      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6">
        <select
          aria-label="Season"
          value={shown}
          onChange={(event) => { setSeason(Number(event.target.value)); setPicking(undefined); }}
          className="h-9 rounded-md border border-[var(--border)] bg-[var(--control)] px-2 text-sm"
        >
          {seasons.map((number) => <option key={number} value={number}>{number === 0 ? 'Specials' : `Season ${number}`}</option>)}
        </select>
        <Button variant="quiet" className="min-h-9 text-sm" onClick={() => setPicking(seasonTarget)}>Pick a season pack</Button>
      </div>
      {sameTarget(picking, seasonTarget) && picker(seasonTarget, `${result.title} season ${shown}`)}
      <ul className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm">
        {all.filter((episode) => episode.seasonNumber === shown).map((episode) => {
          const target: ReleaseTarget = { service: 'sonarr', kind: 'episode', seriesId, episodeId: episode.id };
          return (
            <li key={episode.id}>
              <div className="flex items-center gap-3 px-4 py-2 sm:px-6">
                <span className="w-6 tabular-nums text-[var(--secondary-ink)]">{String(episode.episodeNumber).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1 truncate text-[var(--ink)]">{episode.title}</span>
                <span className="text-[var(--secondary-ink)]">{episode.hasFile ? 'Downloaded' : 'Missing'}</span>
                <Button variant="quiet" className="min-h-8 px-2 text-sm" onClick={() => setPicking(target)}>Pick a release</Button>
              </div>
              {sameTarget(picking, target) && picker(target, `${result.title} episode ${episode.episodeNumber}`)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function OwnedTitle({ result, onUnauthenticated }: { result: SearchResult; onUnauthenticated: () => void }) {
  if (result.libraryId === null) return null;
  return result.type === 'movie'
    ? <OwnedMovie result={result} onUnauthenticated={onUnauthenticated} />
    : <OwnedSeries result={result} onUnauthenticated={onUnauthenticated} />;
}
