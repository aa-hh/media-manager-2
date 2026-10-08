import type { DatabaseSync } from 'node:sqlite';
import type { EventHub } from './events.js';
import type { createProblems } from './problems.js';
import { readSetting } from './services/connection.js';
import { listTorrents, type Torrent } from './torrents.js';

type Problems = ReturnType<typeof createProblems>;
type XmlRpcCall = (method: string, params: readonly string[]) => Promise<unknown>;

export type MessageKind = 'clean' | 'refusal' | 'unregistered' | 'tracker_down' | 'damaged' | 'other';
export type IssueKind = 'unregistered' | 'tracker_down' | 'damaged';

export type Cooldown = { host: string; since: number; text: string; known: boolean; triggerHash: string };
export type Issue = { hash: string; kind: IssueKind; since: number; lastRetryAt: number | null; recheckedAt: number | null; replace: boolean };

// Blutopia's refusal texts from AA-26 (stock UNIT3D and its separate announce server); more are added in settings.
const DEFAULT_REFUSALS = [
  'Your downloading privileges have been disabled! (Read the rules)',
  'Your downloading privileges have been disabled.',
];
const UNREGISTERED = /unregistered|not registered|torrent not found|unknown torrent|torrent does not exist/i;
const TRACKER_DOWN = /timed? ?out|timeout was reached|couldn't connect|could not connect|connection refused|couldn't resolve|could not resolve|bad gateway|service unavailable|server error|\b5\d\d\b|tracker is down|maintenance/i;
const DAMAGED = /hash check|bad chunks|hashing failed|chunk.*fail/i;

export const TRACKER_RETRY_MS = 15 * 60_000;
export const TRACKER_DOWN_LIMIT_MS = 6 * 60 * 60_000;
// A recheck runs inside rTorrent; give it this long to finish before judging the result.
export const RECHECK_SETTLE_MS = 30 * 60_000;

export const classifyMessage = (message: string): { kind: MessageKind; text: string } => {
  if (message === '') return { kind: 'clean', text: '' };
  if (DAMAGED.test(message)) return { kind: 'damaged', text: message };
  const failure = /Failure reason "(.*)"\]?\s*$/s.exec(message);
  if (failure !== null) {
    const text = failure[1];
    return { kind: UNREGISTERED.test(text) ? 'unregistered' : 'refusal', text };
  }
  if (UNREGISTERED.test(message)) return { kind: 'unregistered', text: message };
  if (/^Tracker:/i.test(message) && TRACKER_DOWN.test(message)) return { kind: 'tracker_down', text: message };
  return { kind: 'other', text: message };
};

export const listCooldowns = (database: DatabaseSync): Cooldown[] => database
  .prepare('SELECT host, since, text, known, trigger_hash FROM tracker_cooldowns ORDER BY host')
  .all()
  .map((row) => ({ host: String(row.host), since: Number(row.since), text: String(row.text), known: row.known === 1, triggerHash: String(row.trigger_hash) }));

export const listIssues = (database: DatabaseSync): Issue[] => database
  .prepare('SELECT * FROM torrent_issues ORDER BY since, hash')
  .all()
  .map((row) => ({
    hash: String(row.hash),
    kind: row.kind as IssueKind,
    since: Number(row.since),
    lastRetryAt: row.last_retry_at === null ? null : Number(row.last_retry_at),
    recheckedAt: row.rechecked_at === null ? null : Number(row.rechecked_at),
    replace: row.replace === 1,
  }));

const knownRefusals = (database: DatabaseSync) => {
  const configured = readSetting(database, 'trackerConfiguration', 'refusalTexts') ?? '';
  return [...DEFAULT_REFUSALS, ...configured.split('\n').map((line) => line.trim()).filter((line) => line !== '')]
    .map((text) => text.toLowerCase());
};

export const createTrackerWatch = (options: {
  database: DatabaseSync;
  rtorrent: { call: XmlRpcCall };
  problems: Problems;
  events: EventHub;
  now?: () => number;
}) => {
  const { database, rtorrent, problems, events } = options;
  const now = options.now ?? Date.now;
  const torrentSubject = (hash: string) => ({ type: 'torrent' as const, service: null, id: hash });
  const trackerSubject = (host: string) => ({ type: 'tracker' as const, service: null, id: host });

  const issueProblem = (issue: Pick<Issue, 'hash' | 'kind'>, summary: string) => problems.open({
    kind: issue.kind, subject: torrentSubject(issue.hash), summary, hash: issue.hash,
  });

  const saveIssue = (issue: Issue) => {
    database.prepare(`
      INSERT INTO torrent_issues (hash, kind, since, last_retry_at, rechecked_at, replace) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (hash) DO UPDATE SET kind = excluded.kind, since = excluded.since, last_retry_at = excluded.last_retry_at,
        rechecked_at = excluded.rechecked_at, replace = excluded.replace
    `).run(issue.hash, issue.kind, issue.since, issue.lastRetryAt, issue.recheckedAt, Number(issue.replace));
  };

  const endIssue = (issue: Issue, text: string) => {
    database.prepare('DELETE FROM torrent_issues WHERE hash = ?').run(issue.hash);
    const problem = issueProblem(issue, text);
    problems.setState(problem.id, 'resolved', text);
  };

  const askForReplacement = (issue: Issue, text: string) => {
    saveIssue({ ...issue, replace: true });
    problems.step(issueProblem(issue, text).id, 'result', text);
    events.publish('replacement', { hash: issue.hash, kind: issue.kind });
  };

  const tryCall = async (method: string, hash: string) => {
    try {
      await rtorrent.call(method, [hash]);
      return true;
    } catch {
      return false;
    }
  };

  const startCooldown = (torrent: Torrent, text: string, known: boolean, at: number) => {
    const host = torrent.trackerHost;
    if (host === null || host === '') return;
    if (listCooldowns(database).some((cooldown) => cooldown.host === host)) return;
    database.prepare('INSERT INTO tracker_cooldowns (host, since, text, known, trigger_hash) VALUES (?, ?, ?, ?, ?)')
      .run(host, at, text, Number(known), torrent.hash);
    problems.open({
      kind: 'tracker_cooldown',
      subject: trackerSubject(host),
      summary: known ? `${host} refused a download: "${text}"` : `${host} refused a download with text media-manager-2 doesn't know: "${text}"`,
      state: known ? 'handling' : 'needs_you',
    });
    events.publish('cooldown', { host, since: at, text, known });
  };

  // The cooldown ends when an unfinished torrent on that tracker checks in cleanly after it began (AA-26).
  const endCooldowns = (torrents: Torrent[], at: number) => {
    for (const cooldown of listCooldowns(database)) {
      const cleared = torrents.some((torrent) => torrent.trackerHost === cooldown.host && torrent.goneAt === null
        && !torrent.complete && torrent.message === '' && torrent.lastSeenAt > cooldown.since
        && (torrent.hash === cooldown.triggerHash || torrent.firstSeenAt < cooldown.since));
      if (!cleared) continue;
      database.prepare('DELETE FROM tracker_cooldowns WHERE host = ?').run(cooldown.host);
      const problem = problems.open({ kind: 'tracker_cooldown', subject: trackerSubject(cooldown.host), summary: cooldown.text });
      problems.setState(problem.id, 'resolved', `${cooldown.host} accepted a download again.`);
      events.publish('cooldown', { host: cooldown.host, since: null, text: '', known: cooldown.known, endedAt: at });
    }
  };

  const check = async () => {
    if (problems.pausedBy(['rtorrent']).length > 0) return;
    const at = now();
    const torrents = listTorrents(database);
    const issues = new Map(listIssues(database).map((issue) => [issue.hash, issue]));
    const refusals = knownRefusals(database);

    for (const torrent of torrents) {
      const issue = issues.get(torrent.hash);
      if (torrent.goneAt !== null) {
        if (issue !== undefined) endIssue(issue, 'The torrent left rTorrent.');
        continue;
      }
      const { kind, text } = classifyMessage(torrent.message);

      if (kind === 'refusal' && !torrent.complete) {
        startCooldown(torrent, text, refusals.some((known) => text.toLowerCase().includes(known)), at);
      }

      if (issue !== undefined && issue.replace) continue;

      if (kind === 'unregistered') {
        const next: Issue = issue ?? { hash: torrent.hash, kind, since: at, lastRetryAt: null, recheckedAt: null, replace: false };
        saveIssue(next);
        issueProblem(next, `The tracker no longer knows this torrent: "${text}"`);
        askForReplacement(next, 'Unregistered torrent: blocking it and searching again.');
      } else if (kind === 'tracker_down' && !torrent.complete) {
        const current: Issue = issue?.kind === 'tracker_down'
          ? issue
          : { hash: torrent.hash, kind, since: at, lastRetryAt: null, recheckedAt: null, replace: false };
        if (issue === undefined || issue.kind !== 'tracker_down') {
          saveIssue(current);
          issueProblem(current, `The tracker isn't answering: "${text}"`);
        }
        if (at - current.since >= TRACKER_DOWN_LIMIT_MS) {
          askForReplacement(current, 'The tracker has been down for six hours: treating the torrent as stalled.');
        } else if (current.lastRetryAt === null || at - current.lastRetryAt >= TRACKER_RETRY_MS) {
          const asked = await tryCall('d.tracker_announce', torrent.hash);
          saveIssue({ ...current, lastRetryAt: at });
          problems.step(issueProblem(current, text).id, 'fix', asked ? 'Asked the tracker again.' : 'Could not ask the tracker again.');
        }
      } else if (kind === 'damaged') {
        const current: Issue = issue?.kind === 'damaged'
          ? issue
          : { hash: torrent.hash, kind, since: at, lastRetryAt: null, recheckedAt: null, replace: false };
        if (current.recheckedAt === null) {
          saveIssue(current);
          issueProblem(current, `rTorrent found damaged data: "${text}"`);
          const asked = await tryCall('d.check_hash', torrent.hash);
          saveIssue({ ...current, recheckedAt: at });
          problems.step(issueProblem(current, text).id, 'fix', asked ? 'Rechecking the data once.' : 'Could not start a recheck.');
        } else if (at - current.recheckedAt >= RECHECK_SETTLE_MS) {
          askForReplacement(current, 'Still damaged after a recheck: blocking it and searching again.');
        }
      } else if (issue !== undefined) {
        if (issue.kind === 'tracker_down' && kind === 'clean') endIssue(issue, 'The tracker answered again.');
        if (issue.kind === 'damaged' && kind === 'clean' && issue.recheckedAt !== null && at - issue.recheckedAt >= RECHECK_SETTLE_MS) {
          endIssue(issue, 'The recheck found the data intact.');
        }
      }
    }
    endCooldowns(torrents, at);
  };

  // The stall fix (AA-57) picks these up, replaces the release and then calls done.
  const replacementRequests = () => listIssues(database).filter((issue) => issue.replace);
  const replacementHandled = (hash: string, text: string) => {
    const issue = listIssues(database).find((candidate) => candidate.hash === hash);
    if (issue !== undefined) endIssue(issue, text);
  };

  return { check, replacementRequests, replacementHandled };
};
