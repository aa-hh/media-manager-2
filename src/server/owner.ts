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

// A plain insert: a second owner throws on the primary key, which callers read as "someone else became owner first".
export const saveOwner = (database: DatabaseSync, owner: Owner): void => {
  database.prepare('INSERT INTO owner (id, provider, user_id, user_name, server_name) VALUES (1, ?, ?, ?, ?)')
    .run(owner.provider, owner.userId, owner.userName, owner.serverName);
};
