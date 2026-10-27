import type { Meta, StoryObj } from '@storybook/react-vite';
import { List, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { fn } from 'storybook/test';
import { formatBytes } from '@/downloads/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RowSeason, RowSeasonHeader } from '@/components/ui/row-season';
import { StatusDownloadCircle } from '@/components/ui/status-download-circle';
import { Table } from '@/components/ui/table';
import { ToggleBookmark } from '@/components/ui/toggle-bookmark';
import { Tooltip } from '@/components/ui/tooltip';

// The series page's two season actions: search automatically, and pick a season pack.
const action = (label: string, icon: ReactNode) => (
  <Tooltip text={label}>
    <Button variant="ghost" size="row" iconOnly icon={icon} aria-label={label} onClick={fn()} />
  </Tooltip>
);
const actions = (
  <>
    {action('Search automatically', <Search className="text-muted-foreground" />)}
    {action('Pick a season pack', <List className="text-muted-foreground" />)}
  </>
);

const meta = {
  title: 'UI/RowSeason',
  component: RowSeason,
  tags: ['autodocs'],
  // The row is a set of table cells sized to the header's columns; the series page renders it inside this table.
  decorators: [
    (Story) => (
      <Table aria-label="Seasons">
        <RowSeasonHeader />
        <Story />
      </Table>
    ),
  ],
  args: {
    tabIndex: 0,
    onClick: fn(),
    open: false,
    bookmark: <ToggleBookmark state="all" onToggle={fn()} />,
    title: 'Season 2',
    counts: '10 episodes · all monitored',
    airDates: 'Jan – Mar 2025',
    // The plain status chip, as the series page draws it: neutral with no fill.
    status: <Badge variant="neutral" className="bg-transparent"><span>Aired · 10 of 10</span></Badge>,
    quality: 'WEBDL-1080p',
    size: formatBytes(34.6e9),
    actions,
  },
} satisfies Meta<typeof RowSeason>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const Open: Story = { args: { open: true } };

export const SomeMonitored: Story = {
  args: { bookmark: <ToggleBookmark state="mixed" onToggle={fn()} />, counts: '10 episodes · 6 monitored' },
};

export const NotMonitored: Story = {
  args: { monitored: false, bookmark: <ToggleBookmark state="none" onToggle={fn()} />, counts: '10 episodes · 0 monitored' },
};

export const Missing: Story = {
  args: {
    title: 'Season 3',
    counts: '10 episodes · all monitored',
    airDates: '22 Aug – 24 Oct',
    status: <Badge variant="warning"><span>2 missing · 8 of 10</span></Badge>,
    size: formatBytes(27.4e9),
    marker: 'warning',
  },
};

export const Stalled: Story = {
  args: {
    title: 'Season 3',
    airDates: '22 Aug – 24 Oct',
    status: <Badge variant="risk" icon={<StatusDownloadCircle state="stalled" percent={63} />}><span>1 stalled · 9 of 10</span></Badge>,
    size: formatBytes(31.1e9),
    marker: 'risk',
  },
};

export const Downloading: Story = {
  args: {
    title: 'Season 3',
    airDates: '22 Aug – 24 Oct',
    status: (
      <Badge variant="neutral" icon={<StatusDownloadCircle state="downloading" percent={42} />} className="text-foreground">
        <span>1 downloading · 9 of 10</span>
      </Badge>
    ),
    size: formatBytes(31.1e9),
  },
};

export const MixedQuality: Story = { args: { title: 'Season 1', airDates: 'Feb – Apr 2022', quality: 'Mixed', size: formatBytes(41.9e9) } };

export const NoEpisodesYet: Story = {
  args: {
    title: 'Season 4',
    counts: 'No episodes listed yet',
    airDates: '–',
    status: <Badge variant="neutral" className="bg-transparent"><span>Upcoming</span></Badge>,
    quality: '–',
    size: '–',
  },
};

export const Specials: Story = { args: { title: 'Specials', counts: '2 episodes · 0 monitored', monitored: false, bookmark: <ToggleBookmark state="none" onToggle={fn()} /> } };
