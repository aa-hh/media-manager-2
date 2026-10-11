import type { DatabaseSync } from 'node:sqlite';

// Choices the owner made in the app (such as add defaults), kept apart from settings,
// which hold host-specific configuration and credentials entered by the operator.
export const getPreference = (database: DatabaseSync, key: string): string | undefined => {
  const row = database.prepare('SELECT value FROM preferences WHERE key = ?').get(key);
  return row === undefined || typeof row.value !== 'string' ? undefined : row.value;
};

export const setPreference = (database: DatabaseSync, key: string, value: string): void => {
  database.prepare(`
    INSERT INTO preferences (key, value) VALUES (?, ?)
    ON CONFLICT (key) DO UPDATE SET value = excluded.value
  `).run(key, value);
};
