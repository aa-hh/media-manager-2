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
