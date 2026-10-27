import type { Meta, StoryObj } from '@storybook/react-vite';
import { RefreshCw } from 'lucide-react';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { LineInsetNotice } from '@/components/ui/line-inset-notice';
import { RowEpisodeReleases } from '@/components/ui/row-episode-releases';

const meta = {
  title: 'UI/LineInsetNotice',
  component: LineInsetNotice,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-1237' } },
  // Notices sit at the top of the releases inset, as Pick a release renders them.
  decorators: [
    (Story) => (
      <div role="table" aria-label="Releases" className="w-220">
        <RowEpisodeReleases variant="episode" notices={<Story />} />
      </div>
    ),
  ],
  args: { children: 'Trackers number this episode S01E12.' },
} satisfies Meta<typeof LineInsetNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Status: Story = {};

export const Alert: Story = { args: { role: 'alert', children: "Sonarr didn't take the grab." } };

export const AlertWithButton: Story = {
  args: {
    role: 'alert',
    children: 'These results are out of date. Refresh and pick again.',
    action: <Button variant="outline" size="row" icon={<RefreshCw />} onClick={fn()}>Refresh</Button>,
  },
};

export const ButtonLoading: Story = {
  args: {
    role: 'alert',
    children: "The search didn't reach media-manager-2's server. These are the earlier results.",
    action: <Button variant="outline" size="row" icon={<RefreshCw />} loading disabled>Refresh</Button>,
  },
};

export const LongMessage: Story = {
  args: {
    role: 'alert',
    children: 'Sonarr refused the grab: Release rejected, Not an upgrade for existing episode file(s). Existing quality: WEBDL-1080p v2. New quality: WEBDL-1080p.',
    action: <Button variant="outline" size="row" icon={<RefreshCw />} onClick={fn()}>Try again</Button>,
  },
};

export const Movie: Story = {
  decorators: [
    (Story) => (
      <div role="table" aria-label="Releases" className="w-220">
        <RowEpisodeReleases variant="movie" notices={<Story />} />
      </div>
    ),
  ],
  args: { role: 'alert', children: "Radarr didn't take the grab." },
};
