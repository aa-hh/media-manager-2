import type { Meta, StoryObj } from '@storybook/react-vite';
import { RefreshCw } from 'lucide-react';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';

const meta = {
  title: 'UI/Callout',
  component: Callout,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-629' } },
  args: {
    title: 'Settings could not be read',
    children: 'Check that media-manager-2 is running, then retry.',
  },
} satisfies Meta<typeof Callout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Risk: Story = { args: { look: 'risk' } };

export const Warning: Story = {
  args: {
    look: 'warning',
    title: 'Plex log-in stops working',
    children: 'The Jellyfin administrator who logs in next becomes the owner. The Plex address and token stay saved in case you switch back.',
  },
};

export const Info: Story = {
  args: {
    look: 'info',
    title: 'Using BACKUP_KEY from the env file',
    children: 'Backups keep using it until you create a key here. Backups made before then still need BACKUP_KEY to restore.',
  },
};

export const WithAction: Story = {
  args: { action: <Button variant="outline" icon={<RefreshCw />} onClick={fn()}>Retry</Button> },
};

export const TitleOnly: Story = { args: { title: "The search didn't reach media-manager-2's server.", children: undefined } };
