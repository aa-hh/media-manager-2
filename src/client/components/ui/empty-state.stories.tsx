import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircleCheck, Library, Plus, RefreshCw, SearchX, ShieldCheck } from 'lucide-react';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

const meta = {
  title: 'Feedback & notices/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-766' } },
  args: {
    icon: <Library aria-hidden="true" />,
    title: 'Nothing here yet',
    children: 'Add a show or movie from search.',
    action: <Button variant="outline" kbd="/" onClick={fn()}>Search</Button>,
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TitleOnly: Story = { args: { icon: <CircleCheck />, title: 'Nothing needs attention', children: undefined, action: undefined } };

export const WithoutAction: Story = {
  args: { icon: <SearchX aria-hidden="true" />, title: 'Nothing matches “dune” in Sonarr or Radarr.', children: undefined, action: undefined, className: 'w-130' },
};

export const ActionLoading: Story = {
  args: {
    icon: <SearchX />,
    title: 'No release for this episode',
    children: '2 results were for other episodes',
    action: <Button variant="outline" icon={<RefreshCw />} loading>Search again</Button>,
  },
};

export const MainAction: Story = {
  args: {
    icon: <ShieldCheck />,
    title: 'No trackers added',
    children: 'Add each tracker you use. Its hit and run rule decides when a torrent is safe to remove. Until a tracker has a rule, every torrent from it keeps seeding.',
    action: <Button icon={<Plus />} className="mt-2" onClick={fn()}>Add tracker</Button>,
  },
};
