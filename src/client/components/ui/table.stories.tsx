import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';
import { fn } from 'storybook/test';
import { Logo, trackerLogo, trackerName } from '@/components/ui/logo';
import { Table, TableCell, TableCellTracker, TableHead, TableHeader, TableRow, type TableRowProps } from '@/components/ui/table';

// Sample accounts in the shape of the Health screen's "Tracker accounts" table.
const trackers = [
  { host: 'blutopia.cc', ratio: '3.42', minimum: 0.4, hitAndRuns: '0', cooldown: 'none' },
  { host: 'beyond-hd.me', ratio: '1.87', minimum: 1, hitAndRuns: '2 lifetime', cooldown: 'none' },
  { host: 'privatehd.to', ratio: '0.92', minimum: 1, hitAndRuns: '1', cooldown: 'since 26/10/2026, 21:14:03 · "Too many requests"' },
];

/** The Health screen's tracker table; `rowProps` goes on the first row so each story shows one row state. */
function TrackerAccounts({ rowProps, sorted = false, ...props }: ComponentProps<'div'> & { rowProps?: TableRowProps; sorted?: boolean }) {
  return (
    <Table {...props}>
      <TableHeader>
        <TableHead className="w-40" sorted={sorted}>Tracker</TableHead>
        <TableHead fill>Global ratio</TableHead>
        <TableHead className="w-35">Hit and run</TableHead>
        <TableHead className="w-60">Cooldown</TableHead>
      </TableHeader>
      {trackers.map((tracker, index) => {
        const logo = trackerLogo(tracker.host);
        return (
          <TableRow key={tracker.host} {...(index === 0 ? rowProps : undefined)}>
            <TableCell className="w-40 gap-2">
              {logo !== undefined && <Logo name={logo} alt="" className="size-4" />}
              <span className="truncate font-ui font-semibold">{trackerName(tracker.host)}</span>
            </TableCell>
            <TableCell fill>
              <span className="flex min-w-0 items-center gap-3">
                <span className="font-semibold">{tracker.ratio}</span>
                <span className="truncate text-subtle-foreground">of minimum {tracker.minimum}</span>
              </span>
            </TableCell>
            <TableCell className="w-35">{tracker.hitAndRuns}</TableCell>
            <TableCell className="w-60 text-muted-foreground"><span className="truncate">{tracker.cooldown}</span></TableCell>
          </TableRow>
        );
      })}
    </Table>
  );
}

const meta = {
  title: 'UI/Table',
  component: Table,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-1228' } },
  args: { 'aria-label': 'Tracker accounts' },
  render: (args) => <TrackerAccounts {...args} />,
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SelectedRow: Story = { render: (args) => <TrackerAccounts {...args} rowProps={{ selected: true, 'aria-selected': true }} /> };

export const RiskRow: Story = { render: (args) => <TrackerAccounts {...args} rowProps={{ marker: 'risk' }} /> };

export const WarningRow: Story = { render: (args) => <TrackerAccounts {...args} rowProps={{ marker: 'warning' }} /> };

export const BestRow: Story = { render: (args) => <TrackerAccounts {...args} rowProps={{ best: true }} /> };

export const ProgressRow: Story = { render: (args) => <TrackerAccounts {...args} rowProps={{ progress: 64 }} /> };

export const LineSeason: Story = { render: (args) => <TrackerAccounts {...args} rowProps={{ line: 'season' }} /> };

export const LineEpisode: Story = { render: (args) => <TrackerAccounts {...args} rowProps={{ line: 'episode' }} /> };

export const ClickableRow: Story = { render: (args) => <TrackerAccounts {...args} rowProps={{ onClick: fn(), tabIndex: 0 }} /> };

export const SortedColumn: Story = { render: (args) => <TrackerAccounts {...args} sorted /> };

export const Empty: Story = {
  render: (args) => (
    <Table {...args}>
      <TableHeader>
        <TableHead className="w-40">Tracker</TableHead>
        <TableHead fill>Global ratio</TableHead>
        <TableHead className="w-35">Hit and run</TableHead>
        <TableHead className="w-60">Cooldown</TableHead>
      </TableHeader>
      <TableRow><TableCell fill className="font-ui text-muted-foreground">No trackers seen yet.</TableCell></TableRow>
    </Table>
  ),
};

// TableCellTracker as the release, version, download and blocklist rows use it: a known tracker gets its logo, an
// unknown one only its name, and an empty name draws nothing.
export const TrackerCell: Story = {
  args: { 'aria-label': 'Blocklist' },
  render: (args) => (
    <Table {...args}>
      <TableHeader>
        <TableHead fill>Release</TableHead>
        <TableHead className="w-26">Tracker</TableHead>
        <TableHead align="end" className="w-18">Size</TableHead>
      </TableHeader>
      <TableRow>
        <TableCell fill className="text-muted-foreground"><span className="truncate">Severance.S02E01.Hello.Ms.Cobel.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX</span></TableCell>
        <TableCell className="w-26"><TableCellTracker name="Blutopia" /></TableCell>
        <TableCell align="end" className="w-18">3.4 GB</TableCell>
      </TableRow>
      <TableRow>
        <TableCell fill className="text-muted-foreground"><span className="truncate">Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.HDR.HEVC.TrueHD.Atmos.7.1-FGT</span></TableCell>
        <TableCell className="w-26"><TableCellTracker name="Beyond-HD" /></TableCell>
        <TableCell align="end" className="w-18">71.2 GB</TableCell>
      </TableRow>
      <TableRow>
        <TableCell fill className="text-muted-foreground"><span className="truncate">The.Bear.S03E01.Tomorrow.1080p.DSNP.WEB-DL.DDP5.1.H.264-NTb</span></TableCell>
        <TableCell className="w-26"><TableCellTracker name="TorrentLeech" /></TableCell>
        <TableCell align="end" className="w-18">2.1 GB</TableCell>
      </TableRow>
    </Table>
  ),
};
