// The way into the player from anywhere that has a Play button (library cards, title pages). The player in SignedIn
// registers itself here, so callers need no context and no import of the player's React code.
import type { LoadRequest } from '../desktopBridge';

/** What the player shows before Plex's reply: the title's name, its year or episode, and the Sonarr show behind it for Up Next. */
export type PlayerTitle = { name: string; year: number | null; seriesId: number | null };

export type OpenRequest = { request: LoadRequest; title: PlayerTitle };

type Handler = (open: OpenRequest) => Promise<boolean>;
let handler: Handler | null = null;

export const setPlayerHandler = (next: Handler | null) => {
  handler = next;
};

/**
 * Opens the player full size and loads the title. Resolves true once playback started; false when no player is mounted
 * (a plain browser), a newer Play replaced it, or Plex refused (the player then shows why).
 */
export const openPlayer = (open: OpenRequest) => (handler === null ? Promise.resolve(false) : handler(open));
