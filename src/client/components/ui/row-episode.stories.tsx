import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChevronUp, Ellipsis, List, Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { fn } from 'storybook/test';
import { formatBytes } from '@/downloads/model';
import { relativeAirDate } from '@/title/rows';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RowEpisode, RowEpisodeHeader } from '@/components/ui/row-episode';
import { StatusDownloadCircle } from '@/components/ui/status-download-circle';
import { Table } from '@/components/ui/table';
import { ToggleBookmark } from '@/components/ui/toggle-bookmark';
import { Tooltip } from '@/components/ui/tooltip';

// A fixed "now" so the air dates read the same on every run.
const now = Date.parse('2026-10-27T12:00:00Z');

const action = (label: string, icon: ReactNode, className?: string) => (
  <Tooltip text={label}>
    <Button variant="ghost" size="row" iconOnly icon={icon} aria-label={label} className={className} onClick={fn()} />
  </Tooltip>
);

// The three row buttons the season table gives each episode. While the release list is open, its button turns black with an X.
const actions = ({ pickOpen = false, detailsOpen = false } = {}) => (
  <>
    {action('Search automatically', <Search className="text-muted-foreground" />)}
    {pickOpen
      ? action('Close releases', <X className="text-background" />, 'before:bg-foreground not-data-disabled:hover:before:bg-foreground/85 not-data-disabled:active:before:bg-foreground')
      : action('Pick a release', <List className="text-muted-foreground" />)}
    {detailsOpen
      ? action('Hide details', <ChevronUp className="text-foreground" />, 'bg-surface-pressed')
      : action('Details', <Ellipsis className="text-muted-foreground" />)}
  </>
);

// The status chip the title page draws: a Badge whose label truncates.
const chip = (label: string, props: Partial<Parameters<typeof Badge>[0]> = {}) => (
  <Badge {...props} className={`max-w-full [&>span]:truncate ${props.className ?? ''}`}><span>{label}</span></Badge>
);

const meta = {
  title: 'UI/RowEpisode',
  component: RowEpisode,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-4854' } },
  // Episode rows sit in the Seasons table under the episode header that opens with each season.
  decorators: [
    (Story) => (
      <Table aria-label="Seasons">
        <RowEpisodeHeader />
        <Story />
      </Table>
    ),
  ],
  args: {
    bookmark: <ToggleBookmark state="all" onToggle={fn()} />,
    number: 'E05',
    title: "Trojan's Horse",
    aired: relativeAirDate('2025-02-14T02:00:00Z', now),
    quality: 'WEBDL-1080p',
    size: formatBytes(3_412_000_000),
    actions: actions(),
    tabIndex: 0,
    onClick: fn(),
  },
} satisfies Meta<typeof RowEpisode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnDisk: Story = {};

export const WithMarks: Story = {
  args: {
    number: 'E10',
    title: <>Cold Harbor<Badge variant="outline" className="ml-2">Season finale</Badge></>,
    aired: relativeAirDate('2025-03-21T01:00:00Z', now),
  },
};

export const Missing: Story = {
  args: { marker: 'warning', status: chip('Missing', { variant: 'warning' }), quality: undefined, size: undefined },
};

export const Downloading: Story = {
  args: {
    status: chip('Downloading · 42%', { icon: <StatusDownloadCircle state="downloading" percent={42} />, className: 'text-foreground' }),
    quality: undefined,
    size: undefined,
  },
};

export const Stalled: Story = {
  args: {
    marker: 'risk',
    status: chip('Stalled · 63%', { variant: 'risk', icon: <StatusDownloadCircle state="stalled" percent={63} /> }),
    quality: undefined,
    size: undefined,
  },
};

export const Upcoming: Story = {
  args: {
    number: 'E06',
    title: 'Attila',
    aired: relativeAirDate('2026-10-30T02:00:00Z', now),
    upcoming: true,
    status: chip('Not out yet', { className: 'bg-transparent' }),
    quality: undefined,
    size: undefined,
  },
};

export const NotMonitored: Story = { args: { monitored: false, bookmark: <ToggleBookmark state="none" onToggle={fn()} /> } };

export const ReleasesOpen: Story = { args: { open: true, actions: actions({ pickOpen: true }) } };

export const Selected: Story = { args: { selected: true, 'aria-selected': true } };

export const DetailsOpen: Story = { args: { selected: true, actions: actions({ detailsOpen: true }) } };

// The season's last episode takes the season's full-width line.
export const LastInSeason: Story = { args: { line: 'season' } };
