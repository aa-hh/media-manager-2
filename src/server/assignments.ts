// The manual-import assignment rules, shared by the server and the browser so both refuse the same things.
// This file imports nothing, so the client bundle can use it as is.

export type Assignment = { path: string; episodeIds: number[]; movieId: number | null; qualityId: number | null; languageIds: number[] };

export type AssignmentTarget =
  | { kind: 'series'; episodeIds: number[] }
  | { kind: 'movie'; movieId: number };

export type AssignmentChoices = { paths: string[]; qualityIds: number[]; languageIds: number[] };

const fileName = (path: string) => path.split(/[\\/]/).at(-1) ?? path;

// Returns every reason the assignment can't be imported; an empty list means it can be submitted.
export const checkAssignments = (assignments: Assignment[], target: AssignmentTarget, choices: AssignmentChoices): string[] => {
  const reasons: string[] = [];
  if (assignments.length === 0) return ['Pick at least one file to import.'];
  const paths = new Set(choices.paths);
  const seenPaths = new Set<string>();
  const owners = new Map<number, string>();
  for (const assignment of assignments) {
    const name = fileName(assignment.path);
    if (!paths.has(assignment.path)) reasons.push(`${name} is not in this download.`);
    if (seenPaths.has(assignment.path)) reasons.push(`${name} is listed twice.`);
    seenPaths.add(assignment.path);
    if (target.kind === 'series') {
      if (assignment.episodeIds.length === 0) reasons.push(`${name} has no episode.`);
      const allowed = new Set(target.episodeIds);
      if (assignment.episodeIds.some((id) => !allowed.has(id))) reasons.push(`${name} is assigned to an episode outside this series.`);
      for (const id of new Set(assignment.episodeIds)) {
        const owner = owners.get(id);
        if (owner !== undefined) reasons.push(`${owner} and ${name} are assigned to the same episode.`);
        else owners.set(id, name);
      }
    } else {
      if (assignment.movieId === null) reasons.push(`${name} has no movie.`);
      else if (assignment.movieId !== target.movieId) reasons.push(`${name} is assigned to a different movie.`);
    }
    if (assignment.qualityId === null) reasons.push(`${name} has no quality.`);
    else if (!choices.qualityIds.includes(assignment.qualityId)) reasons.push(`${name} has a quality Sonarr or Radarr doesn't know.`);
    if (assignment.languageIds.length === 0) reasons.push(`${name} has no language.`);
    else if (assignment.languageIds.some((id) => !choices.languageIds.includes(id))) reasons.push(`${name} has a language Sonarr or Radarr doesn't know.`);
  }
  if (target.kind === 'movie' && assignments.length > 1) reasons.push('Only one file can be imported as the movie.');
  return reasons;
};
