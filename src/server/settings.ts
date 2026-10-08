import type { DatabaseSync } from 'node:sqlite';

const categories = new Set([
  'hostPaths',
  'serviceAddresses',
  'trackerConfiguration',
  'credentials',
]);

const validateCategory = (category: string): void => {
  if (typeof category !== 'string' || !categories.has(category)) {
    throw new Error('Invalid settings category.');
  }
};

const validateKey = (key: string): void => {
  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new Error('Setting key must be a nonblank string.');
  }
};

export const getSetting = (database: DatabaseSync, category: string, key: string): string | undefined => {
  validateCategory(category);
  validateKey(key);
  try {
    const row = database.prepare(
      'SELECT value FROM settings WHERE category = ? AND key = ?',
    ).get(category, key);
    if (row === undefined) return undefined;
    if (typeof row.value !== 'string') throw new Error();
    return row.value;
  } catch {
    throw new Error('Could not read setting.');
  }
};

export const listSettingKeys = (database: DatabaseSync): Array<{ category: string; key: string }> => {
  try {
    return database.prepare('SELECT category, key FROM settings ORDER BY category, key').all().map((row) => {
      if (typeof row.category !== 'string' || typeof row.key !== 'string') throw new Error();
      return { category: row.category, key: row.key };
    });
  } catch {
    throw new Error('Could not list settings.');
  }
};

export const setSetting = (
  database: DatabaseSync,
  category: string,
  key: string,
  value: string,
): void => {
  validateCategory(category);
  validateKey(key);
  if (typeof value !== 'string') {
    throw new Error('Setting value must be a string.');
  }
  try {
    database.prepare(`
      INSERT INTO settings (category, key, value) VALUES (?, ?, ?)
      ON CONFLICT (category, key) DO UPDATE SET value = excluded.value
    `).run(category, key, value);
  } catch {
    throw new Error('Could not save setting.');
  }
};

export const deleteSetting = (database: DatabaseSync, category: string, key: string): void => {
  validateCategory(category);
  validateKey(key);
  try {
    database.prepare(
      'DELETE FROM settings WHERE category = ? AND key = ?',
    ).run(category, key);
  } catch {
    throw new Error('Could not delete setting.');
  }
};
