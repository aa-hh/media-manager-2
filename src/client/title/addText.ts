// Words for the add dialog's toast, from the same search fact the sentence's third line shows. No React, so tests load it from source.

export const airDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** What the search covers for the current choices: the sentence's third line and the toast's second line. */
export type SearchFact =
  | { kind: 'none' }
  | { kind: 'unknown' }
  | { kind: 'aired'; count: number }
  | { kind: 'nothingAired'; firstAirDate: string | null }
  | { kind: 'future'; nextAirDate: string | null }
  | { kind: 'now' }
  | { kind: 'expected'; availability: string; date: string | null }
  | { kind: 'collection'; movies: number | null; allReleased: boolean; availability: string };

export type Airing = { seasons: Array<{ seasonNumber: number; aired: number }> | null; nextAirDate: string | null };
export type CollectionSize = { films: number; allReleased: boolean } | null;
type MovieFields = { status: string | null; releaseDates: { inCinemas: string | null; digital: string | null; physical: string | null } };

export const availabilityLabels: Array<[string, string]> = [
  ['announced', 'announced'],
  ['inCinemas', 'in cinemas'],
  ['released', 'available'],
];
export const labelOf = (labels: Array<[string, string]>, value: string) => labels.find(([key]) => key === value)?.[1] ?? value;
const availabilityRank: Record<string, number> = { announced: 0, inCinemas: 1, released: 2 };

/** The search fact for these choices; airing and collection stay undefined until TMDB answers, movie is null for a show. */
export const searchFact = (
  choices: { monitor: string; seasons: number[]; minimumAvailability: string },
  title: { tv: boolean; airing: Airing | null | undefined; collection: CollectionSize | undefined; movie: MovieFields | null },
): SearchFact => {
  if (choices.monitor === 'none') return { kind: 'none' };
  if (choices.monitor === 'skip' && choices.seasons.length === 0) return { kind: 'unknown' };
  if (title.tv) {
    const seasons = title.airing?.seasons ?? null;
    const aired = (keep: (seasonNumber: number) => boolean) => (seasons === null ? null : seasons.filter((season) => keep(season.seasonNumber)).reduce((sum, season) => sum + season.aired, 0));
    const newest = seasons === null ? undefined : seasons.filter((season) => season.seasonNumber > 0).sort((a, b) => b.seasonNumber - a.seasonNumber)[0];
    const count = choices.monitor === 'all' ? aired((seasonNumber) => seasonNumber > 0)
      : choices.monitor === 'lastSeason' ? (newest === undefined ? null : newest.aired)
        : choices.monitor === 'skip' ? aired((seasonNumber) => choices.seasons.includes(seasonNumber))
          : null;
    const nextAirDate = title.airing?.nextAirDate ?? null;
    if (choices.monitor === 'future') return { kind: 'future', nextAirDate };
    if (count === null) return { kind: 'unknown' };
    if (count > 0) return { kind: 'aired', count };
    // A picked season that has not started yet waits for its next episode; 'all' with nothing aired waits for the first.
    return choices.monitor === 'all' ? { kind: 'nothingAired', firstAirDate: nextAirDate } : { kind: 'future', nextAirDate };
  }
  const availability = labelOf(availabilityLabels, choices.minimumAvailability);
  if (choices.monitor === 'movieOnly') {
    // Radarr searches once the movie's status reaches the minimum availability; an unknown status counts as announced.
    if ((availabilityRank[title.movie?.status ?? ''] ?? 0) >= (availabilityRank[choices.minimumAvailability] ?? 0)) return { kind: 'now' };
    const dates = title.movie?.releaseDates ?? null;
    const earliest = [dates?.digital ?? null, dates?.physical ?? null].filter((value): value is string => value !== null).sort()[0] ?? null;
    const expected = choices.minimumAvailability === 'inCinemas' ? dates?.inCinemas ?? null
      : choices.minimumAvailability === 'released' ? earliest
        : null;
    return { kind: 'expected', availability, date: expected !== null && expected.slice(0, 10) > new Date().toISOString().slice(0, 10) ? expected : null };
  }
  return { kind: 'collection', movies: title.collection?.films ?? null, allReleased: title.collection?.allReleased ?? false, availability };
};

/** The toast's second line is before + number + after; number is the part that travels from the dialog, null when nothing does. */
export const addedToast = (serviceName: 'Sonarr' | 'Radarr', title: string, fact: SearchFact): { title: string; before: string; number: string | null; after: string } => {
  const line = (before: string, number: string | null = null, after = '') => ({ title: `Added ${title} to your library`, before, number, after });
  switch (fact.kind) {
    case 'aired':
      return line(`${serviceName} is searching `, String(fact.count), ` aired episode${fact.count === 1 ? '' : 's'}.`);
    case 'nothingAired':
    case 'future':
      return line(`${serviceName} will search once episodes air.`);
    case 'none':
      return line('Nothing is monitored.');
    case 'unknown':
      return line(`${serviceName} is searching for the monitored episodes that have aired.`);
    case 'now':
      return line(`${serviceName} is searching now.`);
    case 'expected':
      return fact.date === null
        ? line(`${serviceName} will search once it's ${fact.availability}.`)
        : line(`${serviceName} will search once it's ${fact.availability}, expected on `, airDate(fact.date), '.');
    case 'collection':
      return fact.movies === null
        ? line(`${serviceName} is searching the collection's movies.`)
        : line(`${serviceName} is searching up to `, String(fact.movies), ` movie${fact.movies === 1 ? '' : 's'}.`);
  }
};
