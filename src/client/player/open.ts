// The way into the player from anywhere that has a Play button (library cards, title pages). The player in SignedIn
// registers itself here, so callers need no context and no import of the player's React code.
import type { LoadRequest } from '../desktopBridge';
import type { EpisodeDetail, SeriesWatch } from '../library/api';

/**
 * What the player shows before Plex's reply: the title's name, its year or episode, the Sonarr show behind it for Up Next,
 * and the backdrop drawn while it opens (a show's for an episode).
 */
export type PlayerTitle = { name: string; year: number | null; seriesId: number | null; backdropUrl: string | null };

/** The show's episodes, which name the episode playing and give Previous, Next and Up Next their stills. */
export type PlayerSeries = { title: string; episodes: EpisodeDetail[]; watch: SeriesWatch };

/** What to play, and the backdrop for it; null when Plex has nothing to play. */
export type Loaded = { request: LoadRequest; backdropUrl: string | null } | null;

/**
 * The player opens on its opening screen straight away (as Plex's own app does) while `loaded` works out what to play.
 * `series`, when the caller already has or is fetching the show, saves the player fetching it again.
 */
export type OpenRequest = { title: PlayerTitle; loaded: Promise<Loaded>; series?: Promise<PlayerSeries> };

type Handler = (open: OpenRequest) => Promise<boolean>;
let handler: Handler | null = null;

export const setPlayerHandler = (next: Handler | null) => {
  handler = next;
};

/**
 * Opens the player full size and loads the title. Resolves true once playback started; false when no player is mounted
 * (a plain browser), a newer Play replaced it, Plex had nothing to play, or Plex refused (the player then shows why).
 */
export const openPlayer = (open: OpenRequest) => (handler === null ? Promise.resolve(false) : handler(open));
