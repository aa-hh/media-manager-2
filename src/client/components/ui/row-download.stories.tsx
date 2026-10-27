import type { Meta, StoryObj } from '@storybook/react-vite';
import { Clock, Ellipsis } from 'lucide-react';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { RowDownload, RowDownloadHeader } from '@/components/ui/row-download';
import { Table } from '@/components/ui/table';

const meta = {
  title: 'UI/Row Download',
  component: RowDownload,
  tags: ['autodocs'],
  // The row is a set of table cells sized to the header's columns; the Downloads screen renders it inside this table.
  decorators: [
    (Story) => (
      <Table aria-label="Being handled by media-manager-2">
        <RowDownloadHeader />
        <Story />
      </Table>
    ),
  ],
  args: {
    title: 'Severance S02E01',
    release: 'Severance.S02E01.Hello.Ms.Cobel.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX · 3.4 GB',
    progress: 42.7,
    speed: '8.2 MB/s',
    eta: '6m',
    tracker: 'Blutopia',
    state: 'downloading',
    stateLabel: 'Downloading · 14 seeders',
    quality: 'WEBDL-1080p',
    size: '3.4 GB',
    actions: <Button variant="ghost" size="row" iconOnly icon={<Ellipsis className="text-muted-foreground" />} aria-label="Actions for Severance S02E01" />,
    onClick: fn(),
  },
} satisfies Meta<typeof RowDownload>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Downloading: Story = {};

export const Importing: Story = { args: { progress: 100, speed: '', eta: '', stateLabel: 'Importing' } };

export const Stalled: Story = {
  args: {
    state: 'stalled',
    progress: 63,
    speed: '0 B/s',
    eta: '–',
    stateLabel: 'Stalled · 0 seeders',
    message: "The tracker can't serve this torrent. (Severance.S02E01.Hello.Ms.Cobel.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX)",
  },
};

export const ImportBlocked: Story = {
  args: {
    title: 'Dune: Part Two',
    release: 'Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.HDR.HEVC.TrueHD.Atmos.7.1-FGT · 71.2 GB',
    state: 'import-blocked',
    progress: 100,
    speed: '',
    eta: '',
    tracker: 'Beyond-HD',
    stateLabel: 'Import blocked',
    quality: 'Remux-2160p',
    size: '71.2 GB',
    message: 'Dune: Part Two: Not an upgrade for existing movie file.',
    bandActions: (
      <>
        <Button size="row" variant="outline" onClick={fn()}>Import by hand</Button>
        <Button size="row" variant="outline-destructive" onClick={fn()}>Remove from downloads</Button>
      </>
    ),
    actions: <Button variant="ghost" size="row" iconOnly icon={<Ellipsis className="text-muted-foreground" />} aria-label="Actions for Dune: Part Two" />,
  },
};

export const Waiting: Story = { args: { state: 'waiting', progress: 0, speed: '', eta: '–', stateLabel: 'Waiting for peers · 3 seeders' } };

export const NotInRtorrentYet: Story = {
  args: {
    state: 'waiting',
    progress: undefined,
    speed: undefined,
    eta: undefined,
    tracker: undefined,
    release: "Severance.S02E01.Hello.Ms.Cobel.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX · 3.4 GB · in Sonarr's queue, not in rTorrent yet",
    stateLabel: <><Clock aria-hidden="true" />Delayed · grabs in 42m</>,
  },
};

export const Selected: Story = { args: { selected: true, 'aria-selected': true } };

export const WithoutBand: Story = { args: { release: undefined } };
