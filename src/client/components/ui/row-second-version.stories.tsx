import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RowSecondVersion, RowSecondVersionHeader } from '@/components/ui/row-second-version';
import { StatusDownloadCircle } from '@/components/ui/status-download-circle';
import { Table } from '@/components/ui/table';

const deleteButton = <Button size="row" variant="outline-destructive" onClick={fn()}>Delete</Button>;

const meta = {
  title: 'UI/RowSecondVersion',
  component: RowSecondVersion,
  tags: ['autodocs'],
  // The movie page renders the rows in its Versions table under this header; under an open episode both are inset.
  decorators: [
    (Story, { args }) => (
      <Table>
        <RowSecondVersionHeader inset={args.inset} />
        <Story />
      </Table>
    ),
  ],
  args: {
    title: 'Second version · added 24 Oct',
    release: 'Dune.Part.Two.2024.1080p.BluRay.DDP5.1.x264-ZQ',
    group: 'ZQ',
    hitAndRun: '41 h of 72 h',
    tracker: 'Blutopia',
    status: <Badge variant="neutral"><span>Seeding</span></Badge>,
    quality: 'Bluray-1080p',
    size: '14.8 GB',
    actions: deleteButton,
  },
} satisfies Meta<typeof RowSecondVersion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SecondVersion: Story = {};

export const Tracked: Story = {
  args: {
    tracked: true,
    title: undefined,
    release: 'Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.HDR.HEVC.TrueHD.Atmos.7.1-FGT',
    group: 'FGT',
    detail: 'HDR10 · TrueHD Atmos 7.1 · English · Remux Tier 01',
    hitAndRun: '120 h of 72 h',
    tracker: 'Beyond-HD',
    status: <Badge variant="neutral" className="bg-transparent"><span>Seeding · rule met</span></Badge>,
    quality: 'Remux-2160p',
    size: '71.2 GB',
  },
};

export const InsetUnderEpisode: Story = {
  args: {
    inset: true,
    release: 'Severance.S02E01.Hello.Ms.Cobel.2160p.ATVP.WEB-DL.DDP5.1.Atmos.DV.HDR.H.265-FLUX',
    group: 'FLUX',
    quality: 'WEBDL-2160p',
    size: '9.6 GB',
  },
};

export const Sending: Story = {
  args: { hitAndRun: '', status: <Badge variant="neutral" spinner><span>Sending</span></Badge>, size: '', actions: undefined },
};

export const Downloading: Story = {
  args: {
    hitAndRun: '',
    status: (
      <Badge variant="neutral" icon={<StatusDownloadCircle state="downloading" percent={42} />} className="text-foreground">
        <span>Downloading 42%</span>
      </Badge>
    ),
    actions: undefined,
  },
};

export const Stalled: Story = {
  args: {
    hitAndRun: '',
    status: <Badge variant="risk" icon={<StatusDownloadCircle state="stalled" percent={63} />}><span>Stalled · 63%</span></Badge>,
    actions: undefined,
  },
};

export const Failed: Story = {
  args: {
    hitAndRun: '',
    detail: <span className="text-destructive">Sonarr or Radarr never reported this grab.</span>,
    status: <Badge variant="risk"><span>Failed</span></Badge>,
    size: '',
  },
};

export const StalledRemoved: Story = {
  args: {
    hitAndRun: '',
    detail: <span className="text-warning">Nothing downloaded; torrent removed</span>,
    status: <Badge variant="warning"><span>Stalled, removed</span></Badge>,
    size: '',
  },
};

export const NoTorrent: Story = {
  args: { hitAndRun: '', status: <Badge variant="neutral" className="bg-transparent"><span>No torrent</span></Badge> },
};
