import type { Meta, StoryObj } from '@storybook/react-vite';
import { Download } from 'lucide-react';
import { fn } from 'storybook/test';
import { formatSize, formatsOf, qualityParts, splitReleaseName } from '@/releaseView';
import { Button } from '@/components/ui/button';
import { ChipFit } from '@/components/ui/chip-fit';
import { ChipReleaseState } from '@/components/ui/chip-release-state';
import { RowEpisodeReleases } from '@/components/ui/row-episode-releases';
import { RowRelease, RowReleaseHeader, RowReleaseSkeleton } from '@/components/ui/row-release';

const grab = (variant: 'default' | 'outline' = 'default', loading = false) => (
  <Button size="row" variant={variant} icon={<Download />} loading={loading} onClick={fn()}>Grab</Button>
);

const meta = {
  title: 'UI/RowRelease',
  component: RowRelease,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-3346' } },
  // Pick a release renders its rows inside the releases inset (movie page: 16 px in), under the releases header. The
  // inset also sets --inset, which the cooldown bar reads to reach the table's left edge.
  decorators: [
    (Story) => (
      <div role="table" aria-label="Releases">
        <RowEpisodeReleases variant="movie" header={<RowReleaseHeader />}>
          <Story />
        </RowEpisodeReleases>
      </div>
    ),
  ],
  args: {
    name: splitReleaseName('Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.HDR.HEVC.TrueHD.Atmos.7.1-FGT', 'movie'),
    formats: formatsOf('TrueHD Atmos', 'DV HDR10'),
    seeders: 48,
    leechers: 3,
    tracker: 'Beyond-HD',
    fit: <ChipFit kind="score">+35</ChipFit>,
    quality: qualityParts('Remux-2160p'),
    size: formatSize(71.2e9),
    action: grab(),
  },
} satisfies Meta<typeof RowRelease>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Best: Story = { args: { best: true, fit: <ChipFit kind="best">+120</ChipFit> } };

export const BestWithoutScores: Story = { args: { best: true, fit: <ChipFit kind="best-star" /> } };

export const NegativeScore: Story = { args: { fit: <ChipFit kind="negative">−10</ChipFit> } };

export const Rejected: Story = {
  args: {
    rejected: true,
    fit: <ChipFit kind="rejected" tooltip="Not an upgrade for existing movie file" />,
    action: grab('outline'),
  },
};

export const Cooldown: Story = { args: { cooldown: true, tracker: 'PrivateHD', action: <ChipReleaseState state="cooldown" /> } };

export const Yours: Story = {
  args: {
    yours: true,
    name: splitReleaseName('Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.HDR.HEVC.TrueHD.Atmos.7.1-FGT', 'movie'),
    seeders: undefined,
    leechers: undefined,
    tracker: '',
    fit: <ChipFit kind="score">+35</ChipFit>,
    action: <ChipReleaseState state="yours" />,
  },
};

export const Grabbing: Story = { args: { action: grab('default', true) } };

export const Grabbed: Story = { args: { action: <ChipReleaseState state="grabbed" /> } };

export const Downloading: Story = { args: { action: <ChipReleaseState state="downloading" percent={42.7} /> } };

export const HistoryGrabbed: Story = { args: { history: { kind: 'grabbed', tooltip: 'Grabbed before on 24 Oct' } } };

export const HistoryFailed: Story = { args: { history: { kind: 'failed', tooltip: 'Failed before on 24 Oct' } } };

export const HistoryBlocklisted: Story = { args: { history: { kind: 'blocklisted', tooltip: 'Blocklisted on 24 Oct' } } };

export const LowSeeders: Story = { args: { seeders: 4, leechers: 1 } };

export const NoSeeders: Story = { args: { seeders: 0, leechers: 0 } };

export const UnknownSeeders: Story = { args: { seeders: null, leechers: null } };

export const Freeleech: Story = { args: { tracker: 'Blutopia', freeleech: 'Freeleech 75%' } };

export const Proper: Story = {
  args: {
    name: splitReleaseName('Dune.Part.Two.2024.PROPER.1080p.BluRay.DDP5.1.x264-ZQ', 'movie'),
    formats: formatsOf('DD+ 5.1', null),
    quality: qualityParts('Bluray-1080p'),
    size: formatSize(14.8e9),
    proper: 'Proper',
  },
};

export const Loading: Story = {
  render: () => <>{Array.from({ length: 4 }, (_, index) => <RowReleaseSkeleton key={index} index={index} />)}</>,
};
