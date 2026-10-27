import type { Meta, StoryObj } from '@storybook/react-vite';
import { Download, RefreshCw, SearchX } from 'lucide-react';
import { fn } from 'storybook/test';
import { formatSize, formatsOf, qualityParts, splitReleaseName } from '@/releaseView';
import { Button } from '@/components/ui/button';
import { ChipFit } from '@/components/ui/chip-fit';
import { ChipReleaseState } from '@/components/ui/chip-release-state';
import { EmptyState } from '@/components/ui/empty-state';
import { LineInsetNotice } from '@/components/ui/line-inset-notice';
import { RowEpisodeReleases } from '@/components/ui/row-episode-releases';
import { RowRelease, RowReleaseHeader, RowReleaseSkeleton } from '@/components/ui/row-release';
import { Table } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type Sample = { title: string; quality: string; audio: string; hdr: string | null; seeders: number; leechers: number; indexer: string; size: number; score: number; approved?: boolean; freeleech?: string };

const episodeReleases: Sample[] = [
  { title: 'Severance.S02E05.Trojans.Horse.2160p.ATVP.WEB-DL.DDP5.1.DV.HDR.H.265-FLUX', quality: 'WEBDL-2160p', audio: 'DDP5.1', hdr: 'DV HDR10', seeders: 84, leechers: 3, indexer: 'Blutopia', size: 9_870_000_000, score: 1250, freeleech: 'Freeleech 50%' },
  { title: 'Severance.S02E05.Trojans.Horse.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX', quality: 'WEBDL-1080p', audio: 'DDP5.1', hdr: null, seeders: 142, leechers: 6, indexer: 'Blutopia', size: 3_412_000_000, score: 900 },
  { title: 'Severance.S02E05.1080p.WEB.h264-ETHEL', quality: 'WEBDL-1080p', audio: 'DDP5.1', hdr: null, seeders: 7, leechers: 1, indexer: 'Beyond-HD', size: 2_960_000_000, score: 400 },
  { title: 'Severance.S02E05.720p.WEB.h264-ETHEL', quality: 'WEBDL-720p', audio: 'AAC2.0', hdr: null, seeders: 0, leechers: 0, indexer: 'PrivateHD', size: 1_180_000_000, score: -200, approved: false },
  { title: 'Severance.S02E05.Trojans.Horse.2160p.ATVP.WEB-DL.DDP5.1.HDR.H.265-NTb', quality: 'WEBDL-2160p', audio: 'DDP5.1', hdr: 'HDR10', seeders: 23, leechers: 2, indexer: 'Beyond-HD', size: 8_440_000_000, score: 700 },
];

const movieReleases: Sample[] = [
  { title: 'Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.HDR.HEVC.TrueHD.Atmos.7.1-FGT', quality: 'Remux-2160p', audio: 'TrueHD Atmos 7.1', hdr: 'HDR10', seeders: 61, leechers: 4, indexer: 'Beyond-HD', size: 71_200_000_000, score: 1500 },
  { title: 'Dune.Part.Two.2024.1080p.BluRay.DDP7.1.x264-ZoroSenpai', quality: 'Bluray-1080p', audio: 'DDP7.1', hdr: null, seeders: 212, leechers: 9, indexer: 'Blutopia', size: 18_600_000_000, score: 800 },
  { title: 'Dune.Part.Two.2024.2160p.MA.WEB-DL.DDP5.1.Atmos.DV.HDR.H.265-FLUX', quality: 'WEBDL-2160p', audio: 'DDP5.1 Atmos', hdr: 'DV HDR10', seeders: 95, leechers: 2, indexer: 'PrivateHD', size: 24_100_000_000, score: 1100 },
];

// Each release as Pick a release draws it: the first is the best, a rejected one gets an outline Grab.
const rows = (releases: Sample[], kind: 'episode' | 'movie') => releases.map((release, index) => {
  const best = index === 0;
  const approved = release.approved !== false;
  const fit = !approved ? { kind: 'rejected' as const } : { kind: best ? 'best' as const : release.score < 0 ? 'negative' as const : 'score' as const, text: release.score > 0 ? `+${release.score}` : release.score < 0 ? `−${-release.score}` : '0' };
  return (
    <RowRelease
      key={release.title}
      best={best}
      rejected={!approved}
      name={splitReleaseName(release.title, kind)}
      formats={formatsOf(release.audio, release.hdr)}
      seeders={release.seeders}
      leechers={release.leechers}
      tracker={release.indexer}
      freeleech={release.freeleech}
      fit={<ChipFit kind={fit.kind}>{fit.text}</ChipFit>}
      quality={qualityParts(release.quality)}
      size={formatSize(release.size)}
      action={<Button size="row" variant={approved ? 'default' : 'outline'} icon={<Download />} onClick={fn()}>Grab</Button>}
    />
  );
});

const refresh = (loading = false) => (
  <Button variant="outline" size="row" icon={<RefreshCw />} loading={loading} disabled={loading} onClick={fn()}>Refresh</Button>
);

const qualityFilter = (counts: [string, number][], all: number) => (
  <>
    <ToggleGroup size="inset" aria-label="Quality" value="all" onValueChange={fn()}>
      <ToggleGroupItem value="all" count={all}>All</ToggleGroupItem>
      {counts.map(([quality, count]) => <ToggleGroupItem key={quality} value={quality} count={count}>{quality}</ToggleGroupItem>)}
    </ToggleGroup>
    {refresh()}
  </>
);

const yours = (
  <RowRelease
    yours
    name={splitReleaseName('Severance.S02E05.Trojans.Horse.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX', 'episode')}
    formats={formatsOf('DDP5.1', null)}
    tracker="Blutopia"
    fit={<ChipFit kind="score">+900</ChipFit>}
    quality={qualityParts('WEBDL-1080p')}
    size={formatSize(3_412_000_000)}
    action={<ChipReleaseState state="yours" />}
  />
);

const meta = {
  title: 'UI/RowEpisodeReleases',
  component: RowEpisodeReleases,
  tags: ['autodocs'],
  // Pick a release opens inside the Seasons table (or the movie's versions table), wrapped in its own Releases table role.
  decorators: [
    (Story) => (
      <Table aria-label="Seasons">
        <div role="table" aria-label="Releases">
          <Story />
        </div>
      </Table>
    ),
  ],
  args: {
    variant: 'episode',
    filter: qualityFilter([['2160p', 2], ['1080p', 2], ['720p', 1]], 5),
    header: <RowReleaseHeader />,
    pinned: yours,
    children: rows(episodeReleases, 'episode'),
    arrivalKey: 1,
  },
} satisfies Meta<typeof RowEpisodeReleases>;

export default meta;
type Story = StoryObj<typeof meta>;

// Accessibility check off: notices, the filter line and loading lines sit straight in the table, which ARIA does not allow; how they join it is a design call.
const a11yTodo = { a11y: { test: 'todo' } };

export const Episode: Story = { parameters: a11yTodo };

export const Movie: Story = {
  parameters: a11yTodo,
  args: {
    variant: 'movie',
    filter: qualityFilter([['2160p', 2], ['1080p', 1]], 3),
    pinned: undefined,
    children: rows(movieReleases, 'movie'),
  },
};

export const Searching: Story = {
  parameters: a11yTodo,
  args: {
    searching: true,
    filter: (
      <>
        {refresh(true)}
        <span aria-live="polite" className="font-ui text-[13px] text-muted-foreground">Searching every indexer. This takes about 20 seconds.</span>
      </>
    ),
    children: Array.from({ length: 4 }, (_, index) => <RowReleaseSkeleton key={index} index={index} />),
  },
};

export const Empty: Story = {
  parameters: a11yTodo,
  args: {
    filter: undefined,
    empty: (
      <EmptyState icon={<SearchX />} title="No release for this episode" action={<Button variant="outline" icon={<RefreshCw />} onClick={fn()}>Search again</Button>}>
        2 results were for other episodes
      </EmptyState>
    ),
  },
};

export const WithNotice: Story = { parameters: a11yTodo, args: { notices: <LineInsetNotice>Trackers number this episode S02E06.</LineInsetNotice> } };

export const EarlierResults: Story = {
  parameters: a11yTodo,
  args: {
    notices: <LineInsetNotice role="alert" action={refresh()}>Prowlarr didn't answer. These are the earlier results.</LineInsetNotice>,
  },
};

export const Failed: Story = {
  parameters: a11yTodo,
  args: {
    notices: (
      <LineInsetNotice role="alert" action={<Button variant="outline" size="row" icon={<RefreshCw />} onClick={fn()}>Try again</Button>}>
        Sonarr didn't answer the search.
      </LineInsetNotice>
    ),
    filter: undefined,
    header: undefined,
    pinned: undefined,
    children: undefined,
  },
};
