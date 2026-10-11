import type { DatabaseSync } from 'node:sqlite';
import type { EventHub } from './events.js';

export type ProblemState = 'handling' | 'needs_you' | 'resolved';
export type SubjectType = 'movie' | 'episode' | 'torrent' | 'tracker' | 'dependency';
export type Subject = { type: SubjectType; service: 'sonarr' | 'radarr' | null; id: string };
export type StepKind = 'problem' | 'fix' | 'result';

export type Step = { at: number; kind: StepKind; text: string };

export type Problem = {
  id: number;
  kind: string;
  subject: Subject;
  hash: string | null;
  state: ProblemState;
  summary: string;
  openedAt: number;
  updatedAt: number;
  resolvedAt: number | null;
  steps: Step[];
};

export const RELEASE_LIMIT = 3;

const readSteps = (database: DatabaseSync, problemId: number): Step[] => database
  .prepare('SELECT at, kind, text FROM problem_steps WHERE problem_id = ? ORDER BY id')
  .all(problemId)
  .map((row) => ({ at: Number(row.at), kind: row.kind as StepKind, text: String(row.text) }));

const readProblem = (database: DatabaseSync, row: Record<string, unknown>): Problem => ({
  id: Number(row.id),
  kind: String(row.kind),
  subject: {
    type: row.subject_type as SubjectType,
    service: row.service === '' ? null : row.service as Subject['service'],
    id: String(row.subject_id),
  },
  hash: row.hash === null ? null : String(row.hash),
  state: row.state as ProblemState,
  summary: String(row.summary),
  openedAt: Number(row.opened_at),
  updatedAt: Number(row.updated_at),
  resolvedAt: row.resolved_at === null ? null : Number(row.resolved_at),
  steps: readSteps(database, Number(row.id)),
});

export const getProblem = (database: DatabaseSync, id: number): Problem | undefined => {
  const row = database.prepare('SELECT * FROM problems WHERE id = ?').get(id);
  return row === undefined ? undefined : readProblem(database, row as Record<string, unknown>);
};

export const listOpenProblems = (database: DatabaseSync): Problem[] => database
  .prepare("SELECT * FROM problems WHERE state != 'resolved' ORDER BY opened_at, id")
  .all()
  .map((row) => readProblem(database, row as Record<string, unknown>));

export const subjectHistory = (database: DatabaseSync, subject: Subject): Problem[] => database
  .prepare('SELECT * FROM problems WHERE subject_type = ? AND service = ? AND subject_id = ? ORDER BY opened_at, id')
  .all(subject.type, subject.service ?? '', subject.id)
  .map((row) => readProblem(database, row as Record<string, unknown>));

export const countReleaseAttempts = (database: DatabaseSync, subject: Subject): number => Number(database
  .prepare('SELECT COUNT(*) AS count FROM release_attempts WHERE subject_type = ? AND service = ? AND subject_id = ?')
  .get(subject.type, subject.service ?? '', subject.id)?.count ?? 0);

export const createProblems = (options: { database: DatabaseSync; events: EventHub; now?: () => number }) => {
  const { database, events } = options;
  const now = options.now ?? Date.now;

  const publish = (id: number) => {
    const problem = getProblem(database, id);
    if (problem !== undefined) events.publish('problem', problem);
    return problem as Problem;
  };

  const insertStep = (problemId: number, at: number, kind: StepKind, text: string) => {
    database.prepare('INSERT INTO problem_steps (problem_id, at, kind, text) VALUES (?, ?, ?, ?)').run(problemId, at, kind, text);
    database.prepare('UPDATE problems SET updated_at = ? WHERE id = ?').run(at, problemId);
  };

  const findOpen = (kind: string, subject: Subject) => {
    const row = database.prepare(`
      SELECT id FROM problems WHERE kind = ? AND subject_type = ? AND service = ? AND subject_id = ? AND state != 'resolved'
    `).get(kind, subject.type, subject.service ?? '', subject.id);
    return row === undefined ? undefined : Number(row.id);
  };

  // At most one open problem per kind and subject: spotting the same problem again returns the open one unchanged.
  const open = (input: { kind: string; subject: Subject; summary: string; hash?: string; state?: Exclude<ProblemState, 'resolved'> }) => {
    const existing = findOpen(input.kind, input.subject);
    if (existing !== undefined) return getProblem(database, existing) as Problem;
    const at = now();
    const result = database.prepare(`
      INSERT INTO problems (kind, subject_type, service, subject_id, hash, state, summary, opened_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.kind, input.subject.type, input.subject.service ?? '', input.subject.id, input.hash ?? null,
      input.state ?? 'handling', input.summary, at, at);
    const id = Number(result.lastInsertRowid);
    insertStep(id, at, 'problem', input.summary);
    return publish(id);
  };

  const step = (id: number, kind: Exclude<StepKind, 'problem'>, text: string) => {
    const problem = getProblem(database, id);
    if (problem === undefined || problem.state === 'resolved') throw new Error('Problem is not open.');
    insertStep(id, now(), kind, text);
    return publish(id);
  };

  const setState = (id: number, state: ProblemState, text: string) => {
    const problem = getProblem(database, id);
    if (problem === undefined || problem.state === 'resolved') throw new Error('Problem is not open.');
    const at = now();
    database.prepare('UPDATE problems SET state = ?, resolved_at = ? WHERE id = ?').run(state, state === 'resolved' ? at : null, id);
    insertStep(id, at, 'result', text);
    return publish(id);
  };

  // Returns how many different releases have now been tried for the subject, toward the give-up limit.
  const recordReleaseAttempt = (subject: Subject, releaseKey: string) => {
    database.prepare(`
      INSERT INTO release_attempts (subject_type, service, subject_id, release_key, tried_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `).run(subject.type, subject.service ?? '', subject.id, releaseKey, now());
    return countReleaseAttempts(database, subject);
  };

  // A down dependency pauses the fixes that need it and is itself a problem for the owner; it resolves when the dependency recovers.
  const syncDependencies = () => {
    const rows = database.prepare('SELECT name, state, detail FROM dependency_status').all();
    for (const row of rows) {
      const subject: Subject = { type: 'dependency', service: null, id: String(row.name) };
      const openId = findOpen('dependency_down', subject);
      if (row.state === 'down' && openId === undefined) {
        open({ kind: 'dependency_down', subject, summary: String(row.detail), state: 'needs_you' });
      } else if (row.state === 'ok' && openId !== undefined) {
        setState(openId, 'resolved', `${String(row.name)} is working again.`);
      }
    }
  };

  const pausedBy = (dependencies: readonly string[]) => dependencies.filter((name) => {
    const row = database.prepare('SELECT state FROM dependency_status WHERE name = ?').get(name);
    return row?.state === 'down';
  });

  return { open, step, setState, recordReleaseAttempt, syncDependencies, pausedBy };
};
