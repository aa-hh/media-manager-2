import type { Meta, StoryObj } from '@storybook/react-vite';
import { Download, FileCheck } from 'lucide-react';
import { fn } from 'storybook/test';
import { formatBytes } from '@/downloads/model';
import { formatWhen } from '@/history/when';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FactRow } from '@/components/ui/fact';
import { RowEpisodeDetails } from '@/components/ui/row-episode-details';
import { RowEpisodeHeader } from '@/components/ui/row-episode';
import { RowHistory, RowHistoryHeader } from '@/components/ui/row-history';
import { RowSecondVersion, RowSecondVersionHeader } from '@/components/ui/row-second-version';
import { SkeletonRow } from '@/components/ui/skeleton';
import { StatusInline } from '@/components/ui/status-inline';
import { Table } from '@/components/ui/table';

// A stand-in 16:9 still drawn inline, so the story loads nothing from the network.
const still = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#dfe7ea"/><rect y="110" width="320" height="70" fill="#9fb4bd"/><rect x="40" y="40" width="70" height="90" fill="#3d5a66"/></svg>')}`;

const details = [
  <FactRow key="aired" label="Aired">Fri 14 Feb · 52 min</FactRow>,
  <FactRow key="monitored" label="Monitored">Yes</FactRow>,
  <FactRow key="last-search" label="Last search">Sat 15 Feb</FactRow>,
  <FactRow key="profile" label="Quality profile">HD-1080p · cutoff met</FactRow>,
  <FactRow key="folder" label="Folder"><span className="[overflow-wrap:anywhere]">/tv/Severance/Season 02</span></FactRow>,
];

// The tracked file then one second version, as the episode's versions table lists them.
const versions = (
  <>
    <RowSecondVersionHeader inset />
    <RowSecondVersion
      tracked
      inset
      release="Severance.S02E05.Trojans.Horse.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX"
      group="FLUX"
      detail="DDP 5.1 · English"
      hitAndRun="41 h of 168 h"
      tracker="Blutopia"
      status={<Badge className="max-w-full [&>span]:truncate"><span>Seeding</span></Badge>}
      quality="WEBDL-1080p"
      size={formatBytes(3_412_000_000)}
    />
    <RowSecondVersion
      inset
      release="Severance.S02E05.Trojans.Horse.2160p.ATVP.WEB-DL.DDP5.1.DV.HDR.H.265-FLUX"
      group="FLUX"
      detail="DV HDR10 · DDP 5.1 · English"
      hitAndRun="212 h of 168 h"
      tracker="Blutopia"
      status={<Badge className="max-w-full bg-transparent [&>span]:truncate"><span>Seeding · rule met</span></Badge>}
      quality="WEBDL-2160p"
      size={formatBytes(9_870_000_000)}
    />
  </>
);

const history = (
  <>
    <RowHistoryHeader />
    <RowHistory when={formatWhen(Date.parse('2026-02-14T03:12:00'))} icon={<FileCheck />} event="Imported WEBDL-1080p · Severance.S02E05.Trojans.Horse.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX" by="" />
    <RowHistory when={formatWhen(Date.parse('2026-02-14T02:41:00'))} icon={<Download />} event="Grabbed WEBDL-1080p · Severance.S02E05.Trojans.Horse.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX" by="" detail="Blutopia" />
  </>
);

const meta = {
  title: 'UI/RowEpisodeDetails',
  component: RowEpisodeDetails,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-8045' } },
  // The band opens under an episode row in the Seasons table; its content starts at the episode header's Title column.
  decorators: [
    (Story) => (
      <Table aria-label="Seasons">
        <RowEpisodeHeader />
        <Story />
      </Table>
    ),
  ],
  args: {
    overview: 'Mark and Helly search for answers on the testing floor while Dylan is offered an unexpected reward.',
    stillUrl: still,
    details,
    versions,
    history,
    historyCount: 2,
    onKeyDown: fn(),
  },
} satisfies Meta<typeof RowEpisodeDetails>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NotSelected: Story = { args: { selected: false } };

export const NoFileYet: Story = {
  args: {
    versions: undefined,
    versionsEmpty: 'No file yet.',
    history: undefined,
    historyCount: 0,
    historyEmpty: 'Sonarr has no history for this yet.',
  },
};

export const HistoryLoading: Story = { args: { history: <SkeletonRow />, historyCount: undefined } };

export const HistoryFailed: Story = {
  args: {
    history: undefined,
    historyCount: undefined,
    historyEmpty: (
      <span className="flex items-center gap-2">
        <StatusInline status="failed">Sonarr didn't answer.</StatusInline>
        <Button variant="outline" size="row" onClick={fn()}>Try again</Button>
      </span>
    ),
  },
};

export const WithoutOverviewOrStill: Story = { args: { overview: undefined, stillUrl: undefined } };
