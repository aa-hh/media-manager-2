// Starts playback in the desktop app from a library card; the player (src/client/player/) takes it from the load request on.
import { inDesktopApp } from '../desktopBridge';
import { openPlayer, type Loaded, type PlayerSeries } from '../player/open';
import { getJson, type ContinueWatchingItem, type LibraryTitle, type MovieWatch } from './api';
import { episodeLoad, movieLoad, type StartFrom } from './watch';

type MovieReply = { watch: MovieWatch; backdropUrl: string | null };
type SeriesReply = PlayerSeries & { backdropUrl: string | null };
/** The parts of a title's detail reply (GET /api/library/movie/:id or /series/:id) that Play needs. */
export type TitleReply = MovieReply | SeriesReply;

/**
 * The load request from a title's detail reply: a movie's version, or a show's asked episode, else Plex's next one, with
 * the reply's backdrop for the player to show while it opens. `mediaIndex` is a version picked on the title page.
 */
const loadedFrom = (reply: TitleReply, item: ContinueWatchingItem | undefined, from: StartFrom, mediaIndex?: number): Loaded => {
  const request = 'episodes' in reply ? episodeLoad(reply, item?.episode ?? null, from, mediaIndex) : movieLoad(reply.watch, from, mediaIndex);
  return request === null ? null : { request, backdropUrl: reply.backdropUrl };
};

const fetchReply = (title: LibraryTitle, onUnauthenticated: () => void, signal?: AbortSignal): Promise<TitleReply> => (title.tv === null
  ? getJson<MovieReply>(`/api/library/movie/${title.id}`, onUnauthenticated, signal)
  : getJson<SeriesReply>(`/api/library/series/${title.id}`, onUnauthenticated, signal));

/** The load request for a title, from its detail reply's Plex ids. Null when Plex has nothing to play. */
export async function loadRequestFor(
  title: LibraryTitle,
  item: ContinueWatchingItem | undefined,
  from: StartFrom,
  onUnauthenticated: () => void,
  signal: AbortSignal,
  mediaIndex?: number,
): Promise<Loaded> {
  return loadedFrom(await fetchReply(title, onUnauthenticated, signal), item, from, mediaIndex);
}

/**
 * Opens the player on the title at once and works out what to play behind its opening screen. Resolves false when Plex
 * has nothing to play, the signal aborted before Play, or there is no player (a plain browser). The player's own Esc
 * cancels a load still opening; the signal does not, because opening the player unmounts the Play button.
 * `options.reply` is the title's detail reply when the page already has it, so nothing is fetched;
 * `options.mediaIndex` plays a version picked on the title page; left out, Plex's default version plays.
 */
export async function playInDesktop(
  title: LibraryTitle,
  item: ContinueWatchingItem | undefined,
  from: StartFrom,
  onUnauthenticated: () => void,
  signal: AbortSignal,
  options?: { mediaIndex?: number; reply?: TitleReply },
): Promise<boolean> {
  if (!inDesktopApp() || signal.aborted) return false;
  // One fetch serves both the load request and, for a show, the player's episode names.
  const reply: Promise<TitleReply> = options?.reply === undefined ? fetchReply(title, onUnauthenticated) : Promise.resolve(options.reply);
  return openPlayer({
    title: { name: title.title, year: title.year, seriesId: title.tv === null ? null : title.id, backdropUrl: options?.reply?.backdropUrl ?? null },
    loaded: reply.then((value) => loadedFrom(value, item, from, options?.mediaIndex)),
    ...(title.tv === null ? {} : { series: reply as Promise<SeriesReply> }),
  });
}
