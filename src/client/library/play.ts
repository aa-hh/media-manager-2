// Starts playback in the desktop app from a library card; the player (src/client/player/) takes it from the load request on.
import { inDesktopApp, type LoadRequest } from '../desktopBridge';
import { openPlayer } from '../player/open';
import { getJson, type ContinueWatchingItem, type LibraryTitle, type MovieWatch, type SeriesWatch } from './api';
import { episodeLoad, movieLoad, type StartFrom } from './watch';

type SeriesReply = { episodes: Array<{ id: number; seasonNumber: number; episodeNumber: number }>; watch: SeriesWatch; backdropUrl: string | null };

/**
 * The load request for a title, from its detail reply's Plex ids: a movie's version, or a show's asked episode, else Plex's
 * next one, with the reply's backdrop for the player to show while it opens. Null when Plex has nothing to play.
 * `mediaIndex` is a version picked on the title page.
 */
export async function loadRequestFor(
  title: LibraryTitle,
  item: ContinueWatchingItem | undefined,
  from: StartFrom,
  onUnauthenticated: () => void,
  signal: AbortSignal,
  mediaIndex?: number,
): Promise<{ request: LoadRequest; backdropUrl: string | null } | null> {
  if (title.tv === null) {
    const movie = await getJson<{ watch: MovieWatch; backdropUrl: string | null }>(`/api/library/movie/${title.id}`, onUnauthenticated, signal);
    const request = movieLoad(movie.watch, from, mediaIndex);
    return request === null ? null : { request, backdropUrl: movie.backdropUrl };
  }
  const show = await getJson<SeriesReply>(`/api/library/series/${title.id}`, onUnauthenticated, signal);
  const request = episodeLoad(show, item?.episode ?? null, from, mediaIndex);
  return request === null ? null : { request, backdropUrl: show.backdropUrl };
}

/**
 * Opens the player on the title. Resolves false when Plex has nothing to play, the signal aborted, or there is no player
 * (a plain browser). The signal stops at the load request: opening the player unmounts the Play button, whose cleanup aborts
 * it, so the player's own Esc cancels a load still opening.
 * `options.mediaIndex` plays a version picked on the title page; left out, Plex's default version plays.
 */
export async function playInDesktop(
  title: LibraryTitle,
  item: ContinueWatchingItem | undefined,
  from: StartFrom,
  onUnauthenticated: () => void,
  signal: AbortSignal,
  options?: { mediaIndex?: number },
): Promise<boolean> {
  if (!inDesktopApp()) return false;
  const loaded = await loadRequestFor(title, item, from, onUnauthenticated, signal, options?.mediaIndex);
  if (loaded === null || signal.aborted) return false;
  return openPlayer({
    request: loaded.request,
    title: { name: title.title, year: title.year, seriesId: title.tv === null ? null : title.id, backdropUrl: loaded.backdropUrl },
  });
}
