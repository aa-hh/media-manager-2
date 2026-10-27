import type { Meta, StoryObj } from '@storybook/react-vite';
import { X } from 'lucide-react';
import { fn } from 'storybook/test';
import { formatWhen } from '@/history/when';
import { Button } from '@/components/ui/button';
import { RowBlocklist, RowBlocklistHeader } from '@/components/ui/row-blocklist';
import { Table } from '@/components/ui/table';

const release = 'Severance.S02E01.Hello.Ms.Cobel.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX';

const meta = {
  title: 'UI/RowBlocklist',
  component: RowBlocklist,
  tags: ['autodocs'],
  // The row's cells are sized to the header's columns; the Blocklist screen renders it inside this table.
  decorators: [
    (Story) => (
      <Table aria-label="Blocklist">
        <RowBlocklistHeader />
        <Story />
      </Table>
    ),
  ],
  args: {
    release,
    title: 'Severance S02E01',
    tracker: 'Blutopia',
    reason: 'by you from Live downloads',
    added: formatWhen(Date.parse('2026-10-14T09:32:00')),
    actions: <Button variant="ghost" size="row" iconOnly icon={<X />} aria-label={`Unblock ${release}`} onClick={fn()} />,
    tabIndex: 0,
    onClick: fn(),
  },
} satisfies Meta<typeof RowBlocklist>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BlockedByYou: Story = {};

export const BlockedAutomatically: Story = {
  args: {
    release: 'Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.HDR.HEVC.TrueHD.Atmos.7.1-FGT',
    title: 'Dune: Part Two',
    tracker: 'Beyond-HD',
    reason: "by media-manager-2: The tracker can't serve this torrent. (Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.HDR.HEVC.TrueHD.Atmos.7.1-FGT)",
  },
};

export const BlockedBySonarr: Story = { args: { tracker: undefined, reason: 'by Sonarr: Manually marked as failed' } };

export const Risk: Story = { args: { marker: 'risk', reason: "by media-manager-2: The tracker can't serve this torrent." } };

export const Warning: Story = { args: { marker: 'warning' } };

export const Selected: Story = { args: { selected: true, 'aria-selected': true } };
