import type { KeyboardEvent } from 'react';
import { formatBytes } from '../downloads/model';
import type { EpisodeDetail, FileDetail } from '../library/api';
import type { SeedingFact } from '../library/progress';
import { Poster } from '../Search';
import { History } from './History';
import { ActionButton } from './TitleHeader';

const when = (iso: string | null) => (iso === null ? '' : new Date(iso).toLocaleString());

export const seedingText = (fact: SeedingFact) =>
  `${fact.trackerHost || 'Unknown tracker'} · ${Math.floor(fact.seedingSeconds / 3600)} h · ratio ${fact.ratio.toFixed(1)}`;

// The file Sonarr or Radarr reports, as one version row; movies use the same table.
export function VersionTable({ file, seeding, label = 'Versions' }: { file: FileDetail | null; seeding: SeedingFact[]; label?: string }) {
  const media = file?.mediaInfo ?? null;
  return (
    <section aria-label={label} className="mt-4 font-data text-[13px]">
      <h3 className="font-ui text-[14px] font-semibold">{label}</h3>
      {file === null
        ? <p className="mt-1 text-[var(--mm-ink-2)]">No file yet.</p>
        : (
          // Hand-off to AA-32: hit and run rule and second-version rows.
          <div className="mt-1 overflow-x-auto">
            <table className="w-full min-w-[44rem] border-y border-[var(--mm-seam)] text-left">
              <thead className="text-[var(--mm-ink-3)]">
                <tr>
                  {['Quality', 'Size', 'Group', 'HDR', 'Audio', 'Languages', 'Score', 'Formats', 'Seeding'].map((heading) => (
                    <th key={heading} scope="col" className="py-1 pr-4 font-normal">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="align-top">
                  <td className="py-1 pr-4">{file.quality ?? ''}</td>
                  <td className="py-1 pr-4">{formatBytes(file.size)}</td>
                  <td className="py-1 pr-4">{file.releaseGroup ?? ''}</td>
                  <td className="py-1 pr-4">{media?.videoDynamicRangeType ?? ''}</td>
                  <td className="py-1 pr-4">{[media?.audioCodec, media?.audioChannels].filter((part) => part != null).join(' ')}</td>
                  <td className="py-1 pr-4">{file.languages.join(', ')}</td>
                  <td className="py-1 pr-4 tabular-nums">{file.customFormatScore}</td>
                  <td className="py-1 pr-4">{file.customFormats.join(', ')}</td>
                  <td className="py-1 pr-4">{seeding.map(seedingText).join('; ')}</td>
                </tr>
              </tbody>
            </table>
            {file.relativePath !== null && <p className="mt-1 text-[var(--mm-ink-3)] [overflow-wrap:anywhere]">{file.relativePath}</p>}
          </div>
        )}
    </section>
  );
}

export function EpisodeDetails({ episode, seeding, onSearch, onPick, onClose, onUnauthenticated }: {
  episode: EpisodeDetail;
  seeding: SeedingFact[];
  onSearch: () => void;
  onPick: () => void;
  onClose: () => void;
  onUnauthenticated: () => void;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    onClose();
  };
  const facts = [
    episode.airDate === null ? '' : `Aired ${when(episode.airDate)}`,
    episode.runtime === null || episode.runtime <= 0 ? '' : `${episode.runtime} min`,
    `Last search ${episode.lastSearchTime === null ? 'never' : when(episode.lastSearchTime)}`,
  ].filter((fact) => fact !== '');
  return (
    <div onKeyDown={onKeyDown} className="border-b border-[var(--mm-seam)] bg-[var(--mm-row-hover)] px-5 py-4 font-ui text-[14px]">
      <div className="flex flex-col gap-4 sm:flex-row">
        <Poster url={episode.imageUrl} className="aspect-video w-56" />
        <div className="min-w-0 flex-1">
          <p className="font-data text-[13px] text-[var(--mm-ink-2)]">{facts.join(' · ')}</p>
          {episode.overview !== null && <p className="mt-2 text-[var(--mm-ink-2)]">{episode.overview}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton onClick={onSearch}>Search automatically</ActionButton>
            <ActionButton onClick={onPick}>Pick a release</ActionButton>
            <ActionButton onClick={onClose}>Close</ActionButton>
          </div>
        </div>
      </div>
      <VersionTable file={episode.file} seeding={seeding} />
      <History query={`service=sonarr&episodeId=${episode.id}`} service="Sonarr" onUnauthenticated={onUnauthenticated} />
    </div>
  );
}
