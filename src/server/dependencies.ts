import type { DatabaseSync } from 'node:sqlite';
import type { EventHub } from './events.js';

export type DependencyStatus = { name: string; state: 'ok' | 'down'; since: number; detail: string };

export const readDependency = (database: DatabaseSync, name: string): DependencyStatus | undefined => {
  const row = database.prepare('SELECT state, since, detail FROM dependency_status WHERE name = ?').get(name);
  if (row === undefined) return undefined;
  const { state, since, detail } = row;
  return { name, state: state as DependencyStatus['state'], since: Number(since), detail: String(detail) };
};

export const writeDependency = (
  database: DatabaseSync,
  events: EventHub,
  name: string,
  state: DependencyStatus['state'],
  at: number,
  detail: string,
) => {
  const previous = readDependency(database, name);
  if (previous?.state === state && previous.detail === detail) return;
  const since = previous?.state === state ? previous.since : at;
  database.prepare(`
    INSERT INTO dependency_status (name, state, since, detail) VALUES (?, ?, ?, ?)
    ON CONFLICT (name) DO UPDATE SET state = excluded.state, since = excluded.since, detail = excluded.detail
  `).run(name, state, since, detail);
  events.publish('dependency', { name, state, since, detail });
};
