// Words for second-version rows, the delete dialogs (second version, movie, show, season) and the Downloads advice line. No React, so tests load it from source.
import type {
  DeleteChoices, DeleteMode, DeleteMonitoring, DeletePlan, DeletePlanDownload, DeletePlanTorrent, DeletePlanVersion, DeleteRan, QueueAction, RemovalAdvice, SecondVersion,
} from '../library/api';

export const recommendationLabels: Record<RemovalAdvice['recommendation'], string> = {
  safe: 'Safe to remove',
  keep: 'Keep seeding',
  unconfirmed: "Can't confirm yet",
};

const whole = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 0 });
// Seeded hours round down and required hours up, so a row never looks closer to the rule than it is.
const seededText = (hours: number) => whole(Math.floor(hours));
const neededText = (hours: number) => whole(Math.ceil(hours));

/** The Hit and run column: seeded against the tracker's rule, hours first, else ratio; empty when no rule applies. */
export const hitAndRunText = (rule: SecondVersion['hitAndRun']) => {
  if (rule === null) return '';
  if (rule.requiredHours !== null) return `${seededText(rule.seededHours)} h of ${neededText(rule.requiredHours)} h`;
  if (rule.requiredRatio !== null) return `ratio ${rule.ratio.toFixed(2)} of ${rule.requiredRatio.toFixed(2)}`;
  return '';
};

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const hoursWord = (hours: number) => (Math.ceil(hours) === 1 ? '1 more hour' : `${whole(Math.ceil(hours))} more hours`);

// True when the advice carries the numbers its seed-time wording needs.
const timed = (advice: RemovalAdvice): advice is RemovalAdvice & { seededHours: number; hoursLeft: number } => (
  advice.host !== null && advice.seededHours !== null && advice.hoursLeft !== null && advice.hoursLeft > 0
);

// `tracker` below is the tracker's display name ("PrivateHD"), not the advice's host.
/** "Keep seeding the torrent" choice in the delete dialog. `askedHours` is the tracker's own rule, without the advice's margin. */
export const keepChoiceText = (advice: RemovalAdvice, tracker: string, askedHours: number | null) => {
  if (advice.recommendation === 'safe') return withGlobalRatio('The torrent keeps seeding in rTorrent', advice);
  const asked = askedHours ?? advice.requiredHours;
  const text = timed(advice) && asked !== null
    ? `Recommended: ${tracker} asks ${neededText(asked)} h, seeded ${seededText(advice.seededHours)} h`
    : `Recommended: ${sentence(advice.detail)}`;
  return withGlobalRatio(text, advice);
};

/** "Remove the torrent too" choice in the delete dialog. */
export const removeChoiceText = (advice: RemovalAdvice, tracker: string) => {
  if (advice.recommendation === 'safe') return `Recommended: ${tracker} rule met, ${advice.detail}`;
  if (advice.recommendation === 'unconfirmed') return "The hit and run rule can't be confirmed.";
  // Kept only for the account's global ratio once the rule itself is met.
  if (advice.hoursLeft === 0 && advice.globalRatio !== null) return `${advice.globalRatio}.`;
  return `Breaks the ${tracker} rule`;
};

/** The Downloads remove dialog's hit and run line. */
export const downloadsAdviceText = (advice: RemovalAdvice, tracker: string) => {
  const text = advice.recommendation !== 'safe' && timed(advice)
    ? `${tracker} needs ${hoursWord(advice.hoursLeft)} to avoid a hit and run`
    : sentence(advice.detail);
  return [text, advice.globalRatio].filter((part) => part !== null).join('. ');
};

const withGlobalRatio = (text: string, advice: RemovalAdvice) => (advice.globalRatio === null ? text : `${text}. ${advice.globalRatio}.`);

// The movie, show, season and selection delete dialog. Every target gets the same plan and reply shapes.
export type DeleteTarget = { kind: 'movie'; id: number } | { kind: 'series'; id: number } | { kind: 'season'; seriesId: number; seasonNumber: number }
  | { kind: 'selection'; seriesId: number; seasons: number[]; episodeIds: number[] };
/** One second version, or every second version that shares a torrent (a pack): one tick box and one torrent choice. */
export type VersionGroup = { key: string; rows: DeletePlanVersion[]; torrent: DeletePlanVersion['torrent'] };
export type VersionChoice = { ticked: boolean; remove: boolean };
export type ResultRow = { look: 'done' | 'kept' | 'failed'; text: string; why: string | null };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const resolution = (quality: string) => /\d{3,4}p/i.exec(quality)?.[0] ?? quality;
const baseName = (path: string) => path.split('/').pop() ?? path;
const serviceName = (plan: Pick<DeletePlan, 'service'>) => (plan.service === 'radarr' ? 'Radarr' : 'Sonarr');

/** The API path both the plan and the delete hang off. */
export const deleteBase = (target: DeleteTarget) => (target.kind === 'movie' ? `/api/library/movie/${target.id}`
  : target.kind === 'series' ? `/api/library/series/${target.id}`
    : target.kind === 'season' ? `/api/library/series/${target.seriesId}/season/${target.seasonNumber}`
      : `/api/library/series/${target.seriesId}/selection`);

export const deletePlanPath = (target: DeleteTarget) => (target.kind === 'selection'
  ? `${deleteBase(target)}/delete-plan?seasons=${target.seasons.join(',')}&episodes=${target.episodeIds.join(',')}`
  : `${deleteBase(target)}/delete-plan`);

// "2 episodes and Season 2", for a selection's title lines.
const selectionName = (target: Extract<DeleteTarget, { kind: 'selection' }>) => [
  target.episodeIds.length === 0 ? null : plural(target.episodeIds.length, 'episode'),
  target.seasons.length === 0 ? null : target.seasons.length === 1 ? `Season ${target.seasons[0]}` : plural(target.seasons.length, 'season'),
].filter((part) => part !== null).join(' and ');

export const deleteTitleText = (target: DeleteTarget, plan: Pick<DeletePlan, 'service' | 'title'>) => (
  target.kind === 'season' ? `Delete Season ${target.seasonNumber} of ${plan.title}?`
    : target.kind === 'selection' ? `Delete ${selectionName(target)} of ${plan.title}?` : `Delete ${plan.title} from ${serviceName(plan)}?`
);

/** What this target may do afterwards. An older server sends no `modes`: a movie chooses, a show is removed, a season unmonitored. */
export const deleteModes = (target: DeleteTarget, plan: Pick<DeletePlan, 'modes'>): DeleteMode[] => (
  plan.modes ?? (target.kind === 'movie' ? ['remove', 'keepUnmonitored'] : target.kind === 'series' ? ['remove'] : ['keepUnmonitored'])
);
/** Remove for a whole title, Keep unmonitored for part of one. */
export const defaultMode = (modes: DeleteMode[]): DeleteMode => (modes.includes('remove') ? 'remove' : 'keepUnmonitored');
/** Downloads are removed unless the owner wants a new release, which a running download may be. */
export const defaultQueueAction = (mode: DeleteMode): QueueAction => (mode === 'searchAgain' ? 'leave' : 'remove');
/** Second versions go with the title, except when searching again, where they may be the copy worth keeping. */
export const defaultVersionChoice = (mode: DeleteMode): VersionChoice => ({ ticked: mode !== 'searchAgain', remove: false });

/** The Afterwards choice's title and description. */
export const modeChoiceText = (target: DeleteTarget, plan: Pick<DeletePlan, 'service'>, mode: DeleteMode) => {
  const service = serviceName(plan);
  const what = target.kind === 'movie' ? 'the movie' : target.kind === 'series' ? 'the show' : 'these episodes';
  const files = target.kind === 'movie' ? 'the file' : 'the files';
  if (mode === 'remove') return { title: `Remove from ${service}`, description: `Removes ${what} from ${service} and deletes ${target.kind === 'movie' ? 'its file' : 'its files'}.` };
  if (mode === 'keepUnmonitored') {
    const scope = target.kind === 'series' ? 'the show and new seasons' : what;
    return { title: `Keep in ${service}, unmonitored`, description: `Deletes ${files} and unmonitors ${scope}, so ${service} won't search again.` };
  }
  return { title: 'Delete and search again', description: `Deletes ${files} and keeps ${what} monitored. ${service} searches for a new release straight away.` };
};

/** The line under the title: what goes, and how big it is. `size` formats bytes. */
export const deleteSubjectText = (target: DeleteTarget, plan: DeletePlan, mode: DeleteMode, size: (bytes: number) => string) => {
  const fileBytes = plan.files.reduce((sum, file) => sum + file.sizeBytes, 0);
  const versionBytes = plan.secondVersions.reduce((sum, version) => sum + (version.sizeBytes ?? 0), 0);
  const movie = target.kind === 'movie';
  const parts = [
    plan.files.length === 0 ? null : `${movie && plan.files.length === 1 ? 'its library file' : plural(plan.files.length, 'library file')}, ${size(fileBytes)}`,
    plan.secondVersions.length === 0 ? null
      : `${movie && plan.secondVersions.length === 1 ? `its ${resolution(plan.secondVersions[0].quality)} second version` : plural(plan.secondVersions.length, 'second version')}, ${size(versionBytes)}`,
  ].filter((part) => part !== null).join(', and ');
  const deletes = `Deletes ${parts === '' ? 'no files' : parts}`;
  const what = mode === 'searchAgain' ? `${deletes} and searches for a new release.`
    : target.kind === 'season' || target.kind === 'selection' ? `${deletes}.`
      : mode === 'keepUnmonitored' ? `Keeps the ${movie ? 'movie' : 'show'} in ${serviceName(plan)}, unmonitored${parts === '' ? '.' : `, and deletes ${parts}.`}`
        : `Removes the ${movie ? 'movie' : 'show'} from ${serviceName(plan)}${parts === '' ? '.' : ` and deletes ${parts}.`}`;
  return `${what}${movie ? '' : ' Each torrent is asked about once.'} Torrents keep seeding unless you choose otherwise.`;
};

/** A torrent row's advice line: "Keep seeding" and "seeded 41 h of 72 h; 31 h left". `askedHours` is the tracker's own rule, without the margin. */
export const adviceLine = (advice: RemovalAdvice, tracker: string, askedHours: number | null = null) => {
  let reason = advice.detail;
  if (advice.recommendation !== 'unconfirmed' && advice.seededHours !== null && advice.requiredHours !== null) {
    const asked = askedHours ?? advice.requiredHours;
    reason = advice.hoursLeft !== null && advice.hoursLeft > 0
      ? `seeded ${seededText(advice.seededHours)} h of ${neededText(asked)} h; ${neededText(advice.hoursLeft)} h left`
      : `seeded ${seededText(advice.seededHours)} h; ${tracker} asks ${neededText(asked)} h`;
  }
  return { verdict: recommendationLabels[advice.recommendation], reason: advice.globalRatio === null ? reason : `${reason}. ${advice.globalRatio}` };
};

const codeIn = (path: string) => {
  const match = /S(\d{1,3})E(\d{1,3})/i.exec(baseName(path));
  return match === null ? null : `S${match[1].padStart(2, '0')}E${match[2].padStart(2, '0')}`;
};
// A season delete names episodes as "E05", since the season is in the title.
const shortCode = (target: DeleteTarget, code: string) => (target.kind === 'season' ? code.replace(/^S\d+/, '') : code);
const sameSeason = (codes: string[]) => new Set(codes.map((code) => code.slice(0, 3))).size === 1;
const listed = (codes: string[]) => (codes.length <= 6 ? codes.join(', ') : `${codes.slice(0, 6).join(', ')} and ${codes.length - 6} more`);

/** What a torrent holds of this title: "Holds E05", "Season pack · holds E01, E02", or that it was upgraded away. */
export const torrentHoldsText = (target: DeleteTarget, torrent: Pick<DeletePlanTorrent, 'upgradedAway' | 'libraryPaths'>) => {
  if (torrent.upgradedAway) return 'Upgraded away; backs no library file';
  const codes = [...new Set(torrent.libraryPaths.flatMap((path) => codeIn(path) ?? []))].sort();
  const count = torrent.libraryPaths.length;
  if (codes.length === 0) return count === 1 ? 'Holds the library file' : `Holds ${count} library files`;
  const named = codes.map((code) => shortCode(target, code));
  if (codes.length === 1) return `Holds ${named[0]}`;
  return sameSeason(codes) ? `Season pack · holds ${listed(named)}` : `Holds ${listed(named)}`;
};

/** Second versions grouped by torrent, so a pack is asked about once. */
export const versionGroups = (plan: Pick<DeletePlan, 'secondVersions'>): VersionGroup[] => {
  const groups = new Map<string, VersionGroup>();
  for (const row of plan.secondVersions) {
    const key = row.torrent === null ? `version:${row.id}` : row.torrent.hash;
    const group = groups.get(key);
    if (group === undefined) groups.set(key, { key, rows: [row], torrent: row.torrent });
    else group.rows.push(row);
  }
  return [...groups.values()];
};

/** "Second version · 1080p WEB-DL", "Second version of S02E04" or "Season pack · second versions of S01E01 to S01E09". `codeOf` names an episode id. */
export const versionHoldsText = (target: DeleteTarget, group: VersionGroup, codeOf: (episodeId: number) => string | null) => {
  if (target.kind === 'movie') return group.rows.length === 1 ? `Second version · ${group.rows[0].quality}` : `${plural(group.rows.length, 'second version')} in one torrent`;
  const codes = [...new Set(group.rows.flatMap((row) => (row.episodeId === null ? [] : codeOf(row.episodeId) ?? [])))].sort();
  const named = codes.map((code) => shortCode(target, code));
  if (group.rows.length === 1) return named.length === 1 ? `Second version of ${named[0]}` : `Second version · ${group.rows[0].quality}`;
  const span = named.length === 0 ? '' : named.length === 1 ? ` of ${named[0]}` : ` of ${named[0]} to ${named.at(-1)}`;
  return `${codes.length > 0 && sameSeason(codes) ? 'Season pack' : 'Pack'} · second versions${span}`;
};

/** The answers beyond torrents and second versions, sent only once the plan carries `modes`. */
export type DeleteIntent = {
  plan: DeletePlan;
  excludeFromImportLists: boolean;
  blocklistCurrent: boolean;
  /** Answers by airing season number; the caller blocks the delete until each has one. */
  keepFollowing: ReadonlyMap<number, boolean>;
  queue: ReadonlyMap<string, QueueAction>;
};

/** True while an airing season has no answer: there is no default, so the delete waits for one. */
export const followingUnanswered = (plan: DeletePlan, keepFollowing: ReadonlyMap<number, boolean>) => (
  (plan.monitoring?.airingSeasons ?? []).some((season) => !keepFollowing.has(season))
);

/** The request body from the owner's choices; a torrent or download whose removal is not allowed is never asked for. */
export const deleteChoices = (
  target: DeleteTarget,
  mode: DeleteMode,
  removeTorrents: ReadonlySet<string>,
  groups: VersionGroup[],
  picks: ReadonlyMap<string, VersionChoice>,
  intent?: DeleteIntent,
): DeleteChoices => {
  const torrents = {
    removeTorrents: [...removeTorrents],
    secondVersions: groups.flatMap((group) => {
      const pick = picks.get(group.key) ?? defaultVersionChoice(mode);
      if (!pick.ticked) return [];
      const remove = pick.remove && group.torrent !== null && group.torrent.removal.allowed;
      return group.rows.map((row) => ({ id: row.id, removeTorrent: remove }));
    }),
  };
  // An older server rejects keys it doesn't know, so it gets the request it was built for.
  if (intent?.plan.modes === undefined) return { ...(target.kind === 'movie' ? { mode } : {}), ...torrents };
  const { plan } = intent;
  return {
    mode,
    excludeFromImportLists: mode === 'remove' && plan.importLists === true && intent.excludeFromImportLists,
    blocklistCurrent: mode === 'searchAgain' && intent.blocklistCurrent,
    keepFollowing: Object.fromEntries((plan.monitoring?.airingSeasons ?? []).flatMap((season) => {
      const answer = intent.keepFollowing.get(season);
      return answer === undefined ? [] : [[String(season), answer]];
    })),
    queue: (plan.queue ?? []).map((download) => ({
      downloadId: download.downloadId,
      action: download.removable.allowed ? intent.queue.get(download.downloadId) ?? defaultQueueAction(mode) : 'leave',
    })),
    ...torrents,
    ...(target.kind === 'selection' ? { seasons: target.seasons, episodeIds: target.episodeIds } : {}),
  };
};

/** The main button: "Delete movie, keep seeding", "Delete show and 2 torrents" once a removal is chosen, or "Delete file and search again". */
export const deleteActionText = (target: DeleteTarget, mode: DeleteMode, choices: DeleteChoices, groups: VersionGroup[]) => {
  const noun = target.kind === 'movie' ? (mode === 'remove' ? 'Delete movie' : 'Delete file')
    : target.kind === 'series' ? (mode === 'remove' ? 'Delete show' : 'Delete files')
      : target.kind === 'season' ? 'Delete season'
        : target.seasons.length === 0 ? `Delete ${plural(target.episodeIds.length, 'episode')}` : 'Delete selection';
  if (mode === 'searchAgain') return `${noun} and search again`;
  const packs = groups.filter((group) => group.rows.some((row) => choices.secondVersions.some((choice) => choice.id === row.id && choice.removeTorrent)));
  const removing = choices.removeTorrents.length + packs.length;
  return removing === 0 ? `${noun}, keep seeding` : `${noun} and ${plural(removing, 'torrent')}`;
};

/** A download row's second line: "Downloading 42% · for S02E08". `codeOf` names an episode id. */
export const downloadHoldsText = (download: DeletePlanDownload, codeOf: (episodeId: number) => string | null) => {
  const codes = [...new Set(download.episodeIds.flatMap((id) => codeOf(id) ?? []))].sort();
  const state = `${sentence(download.status)} ${Math.floor(download.progress * 100)}%`;
  return codes.length === 0 ? state : `${state} · for ${listed(codes)}`;
};

/** The result's Monitoring lines, from what Sonarr or Radarr reported after the delete. */
export const monitoringLines = (monitoring: DeleteMonitoring): string[] => {
  if (monitoring.kind === 'movie') return [monitoring.monitored ? 'Movie monitored' : 'Movie not monitored'];
  if (!monitoring.monitored) return ['Show not monitored'];
  const seasons = [...monitoring.seasons].sort((a, b) => a.seasonNumber - b.seasonNumber).map((season) => {
    const name = season.seasonNumber === 0 ? 'Specials' : `Season ${season.seasonNumber}`;
    return season.monitored ? `${name} monitored · ${season.monitoredEpisodes} of ${plural(season.episodes, 'episode')}` : `${name} not monitored`;
  });
  const followed = monitoring.monitorNewItems === null ? [] : [monitoring.monitorNewItems === 'all' ? 'New seasons followed' : 'New seasons not followed'];
  return [...seasons, ...followed];
};

export const deleteResultTitle = (target: DeleteTarget, plan: Pick<DeletePlan, 'title'>, deleted: boolean) => {
  const name = target.kind === 'season' ? `Season ${target.seasonNumber} of ${plan.title}`
    : target.kind === 'selection' ? `${sentence(selectionName(target))} of ${plan.title}` : plan.title;
  return deleted ? `${name} deleted` : `${name} was not deleted`;
};

// Why a kept torrent still seeds, from its advice: " PrivateHD needs 31 more hours." `tracker` names the advice's host.
const keptWhy = (advice: RemovalAdvice, tracker: string) => {
  if (advice.recommendation === 'unconfirmed') return ' Seeding not confirmed yet.';
  if (advice.recommendation === 'keep' && advice.hoursLeft !== null && advice.hoursLeft > 0) return ` ${tracker} needs ${hoursWord(advice.hoursLeft)}.`;
  return '';
};
const looks = { done: 'done', skipped: 'kept', failed: 'failed' } as const;

/**
 * The results screen, from the delete's steps in the order they ran, with each torrent and second version's outcome.
 * `tracker` turns an advice host into the tracker's name.
 */
export const deleteResultRows = (plan: DeletePlan, choices: DeleteChoices, ran: DeleteRan, tracker: (host: string | null) => string): ResultRow[] => {
  const rows: ResultRow[] = [];
  for (const step of ran.steps) {
    // Monitoring is shown as its own block under the steps; only a failure to read it back is a row.
    if (step.step === 'map' || (step.step === 'monitoring' && step.outcome !== 'failed')) continue;
    if (step.step === 'queue') {
      for (const download of step.queue) {
        rows.push(download.removed
          ? { look: 'done', text: `Removed ${download.title} from the queue`, why: download.torrentRemoved ? 'You chose to remove it with its torrent.' : 'You chose to remove it. Its torrent stays in rTorrent.' }
          : { look: 'failed', text: `Couldn't remove ${download.title} from the queue`, why: download.reason });
      }
      for (const download of plan.queue ?? []) {
        if (step.queue.some((outcome) => outcome.downloadId === download.downloadId)) continue;
        rows.push({ look: 'kept', text: `Left ${download.title} downloading`, why: download.removable.allowed ? 'You chose to leave it.' : download.removable.reason });
      }
      continue;
    }
    if (step.step === 'torrents') {
      for (const torrent of step.torrents) {
        rows.push(torrent.removed
          ? { look: 'done', text: `Removed ${torrent.name} and its data`, why: 'You chose to remove it.' }
          : { look: 'failed', text: `Couldn't remove ${torrent.name}`, why: torrent.reason });
      }
      for (const torrent of plan.torrents) {
        if (step.torrents.some((outcome) => outcome.hash === torrent.hash)) continue;
        const why = torrent.removal.allowed ? `You chose to keep it.${keptWhy(torrent.advice, tracker(torrent.advice.host))}` : torrent.removal.reason;
        rows.push({ look: 'kept', text: `Kept ${torrent.name} seeding`, why });
      }
      for (const file of plan.files) {
        if (file.note !== null) rows.push({ look: 'kept', text: `Left the torrent for ${baseName(file.path)} alone`, why: "The file couldn't be linked to a torrent." });
      }
      continue;
    }
    if (step.step === 'secondVersions') {
      rows.push({ look: looks[step.outcome], text: step.message, why: null });
      const outcomes = new Map(step.secondVersions.map((outcome) => [outcome.id, outcome]));
      for (const group of versionGroups(plan)) {
        const mine = group.rows.flatMap((row) => outcomes.get(row.id) ?? []);
        for (const outcome of mine) {
          if (outcome.deleted) continue;
          const row = group.rows.find((candidate) => candidate.id === outcome.id) as DeletePlanVersion;
          rows.push({ look: 'failed', text: `Couldn't delete the second version ${row.releaseTitle}`, why: outcome.reason });
        }
        if (group.torrent === null || !mine.some((outcome) => outcome.deleted)) continue;
        const name = group.rows[0].releaseTitle;
        const of = group.rows.length > 1 ? `Torrent of the ${group.rows.length} second versions. ` : '';
        const asked = choices.secondVersions.some((choice) => choice.removeTorrent && group.rows.some((row) => row.id === choice.id));
        const reason = mine.find((outcome) => outcome.reason !== null)?.reason ?? '';
        if (mine.some((outcome) => outcome.torrentRemoved)) rows.push({ look: 'done', text: `Removed ${name} and its data`, why: `${of}You chose to remove it.` });
        else if (asked) rows.push({ look: 'failed', text: `Couldn't remove ${name}`, why: `${of}${reason}`.trim() });
        else {
          const why = group.torrent.removal.allowed ? `You chose to keep it.${keptWhy(group.torrent.advice, tracker(group.torrent.advice.host))}` : group.torrent.removal.reason;
          rows.push({ look: 'kept', text: `Kept ${name} seeding`, why: `${of}${why}` });
        }
      }
      continue;
    }
    // Files still there after the wait: the paths go under the step.
    const [text, still] = step.message.split(' Still there: ');
    rows.push({ look: looks[step.outcome], text, why: still === undefined ? null : `Still there: ${still}` });
  }
  return rows;
};
