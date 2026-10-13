import type { DatabaseSync } from 'node:sqlite';

export type Owner = {
  provider: 'plex' | 'jellyfin';
  userId: string;
  userName: string;
  serverName: string | null;
};

export const readOwner = (database: DatabaseSync): Owner | undefined => {
  const row = database.prepare('SELECT provider, user_id, user_name, server_name FROM owner WHERE id = 1').get() as
    | { provider: Owner['provider']; user_id: string; user_name: string; server_name: string | null }
    | undefined;
  return row === undefined
    ? undefined
    : { provider: row.provider, userId: row.user_id, userName: row.user_name, serverName: row.server_name };
};

// PLEX_OWNER_ID, when valid, pins the owner and outranks the owner row.
export const readEnvironmentOwner = (ownerPlexId: string | undefined): Owner | undefined => {
  if (ownerPlexId === undefined || !/^[1-9]\d*$/.test(ownerPlexId)) return undefined;
  const ownerId = Number(ownerPlexId);
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0 || String(ownerId) !== ownerPlexId) return undefined;
  return { provider: 'plex', userId: String(ownerId), userName: '', serverName: null };
};

// The owner every caller acts on; read on each call, so the first sign-in's owner row takes effect at once.
export const effectiveOwner = (database: DatabaseSync, ownerPlexId: string | undefined): Owner | undefined => (
  readEnvironmentOwner(ownerPlexId) ?? readOwner(database)
);

// A plain insert: a second owner throws on the primary key, which callers read as "someone else became owner first".
export const saveOwner = (database: DatabaseSync, owner: Owner): void => {
  database.prepare('INSERT INTO owner (id, provider, user_id, user_name, server_name) VALUES (1, ?, ?, ?, ?)')
    .run(owner.provider, owner.userId, owner.userName, owner.serverName);
};
