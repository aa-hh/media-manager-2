import type { DatabaseSync } from 'node:sqlite';
import { readOwner } from '../owner.js';
import type { ConnectionStatus, ServiceOptions } from './connection.js';
import { createJellyfin } from './jellyfin.js';
import { createPlex } from './plex.js';

export type LibraryType = 'movie' | 'show';
export type Library = { id: string };

// What the app asks of a media server: Plex and Jellyfin each answer it in their own API.
export type MediaServer = {
  name: 'plex' | 'jellyfin';
  label: string;
  check(): Promise<ConnectionStatus>;
  // Throws when the server is unset, unreachable or refuses; undefined means no library of that type reads the folder.
  findLibraryFor(folder: string, type: LibraryType): Promise<Library | undefined>;
  // Throws when the server is unreachable; neither server confirms the scan, so its answer is not read.
  refresh(library: Library, folder: string): Promise<void>;
};

// One media server per install: Jellyfin when the owner signed in with Jellyfin, else Plex. Picked on every call, so the
// first-run sign-in needs no restart.
export const createMediaServer = (database: DatabaseSync, options: ServiceOptions = {}) => {
  const plex = createPlex(database, options);
  const jellyfin = createJellyfin(database, options);
  return (): MediaServer => (readOwner(database)?.provider === 'jellyfin' ? jellyfin : plex);
};
