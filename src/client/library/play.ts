// Starts playback in the desktop app from a library card; the player (src/client/player/) takes it from the load request on.
import { inDesktopApp, type LoadRequest } from '../desktopBridge';
import { openPlayer } from '../player/open';
import { getJson, type ContinueWatchingItem, type LibraryTitle, type MovieWatch, type SeriesWatch } from './api';
import { episodeLoad, movieLoad, type StartFrom } from './watch';

type SeriesReply = { episodes: Array<{ id: number; seasonNumber: number; episodeNumber: number }>; watch: SeriesWatch };

/**
 * The load request for a title, from its detail reply's Plex ids: a movie's version, or a show's asked episode, else Plex's
 * next one. Null when Plex has nothing to play. `mediaIndex` is a version picked on the title page.
 */
export async function loadRequestFor(
  title: LibraryTitle,
  item: ContinueWatchingItem | undefined,
  from: StartFrom,
  onUnauthenticated: () => void,
  signal: AbortSignal,
  mediaIndex?: number,
): Promise<LoadRequest | null> {
  return title.tv === null
    ? movieLoad((await getJson<{ watch: MovieWatch }>(`/api/library/movie/${title.id}`, onUnauthenticated, signal)).watch, from, mediaIndex)
    : episodeLoad(await getJson<SeriesReply>(`/api/library/series/${title.id}`, onUnauthenticated, signal), item?.episode ?? null, from, mediaIndex);
}

/**
 * Opens the player on the title. Resolves false when Plex has nothing to play, the signal aborted, or there is no player
 * (a plain browser); the player itself stops a load that the signal aborts, unless a newer Play has started since.
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
  const request = await loadRequestFor(title, item, from, onUnauthenticated, signal, options?.mediaIndex);
  if (request === null || signal.aborted) return false;
  return openPlayer({ request, title: { name: title.title, year: title.year, seriesId: title.tv === null ? null : title.id }, signal });
}
