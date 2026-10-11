// Episode range selection for the title pages. No runtime imports so the tests can load this file from source.
export type RowRef = { kind: 'season' | 'episode' | 'version'; key: string; episodeId: number | null };

// Episode ids between two row indexes inclusive, in row order; season and version rows never join a range.
export const rangeBetween = (rows: RowRef[], anchorIndex: number, targetIndex: number): number[] => {
  const from = Math.min(anchorIndex, targetIndex);
  const to = Math.max(anchorIndex, targetIndex);
  return rows.slice(from, to + 1).flatMap((row) => (row.kind === 'episode' && row.episodeId !== null ? [row.episodeId] : []));
};

export const moveFocus = (rows: RowRef[], index: number, delta: number) => Math.min(rows.length - 1, Math.max(0, index + delta));

export const selectionSummary = (
  selected: Set<number>,
  episodes: Array<{ id: number; seasonNumber: number; episodeNumber: number; monitored: boolean }>,
): string => {
  const chosen = episodes.filter((episode) => selected.has(episode.id));
  const seasons = new Set(chosen.map((episode) => episode.seasonNumber));
  if (chosen.length === 0) return '';
  if (seasons.size > 1) return `${chosen.length} episodes selected`;
  const numbers = chosen.map((episode) => episode.episodeNumber);
  const monitored = chosen.filter((episode) => episode.monitored).length;
  return `Episodes ${Math.min(...numbers)} to ${Math.max(...numbers)} selected · ${monitored} monitored`;
};
