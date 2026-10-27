import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { RowService } from '@/components/ui/row-service';

const meta = {
  title: 'UI/RowService',
  component: RowService,
  tags: ['autodocs'],
  // Settings lists the rows in this 420 px column.
  decorators: [
    (Story) => (
      <nav aria-label="Services" className="flex w-105 shrink-0 flex-col">
        <Story />
      </nav>
    ),
  ],
  args: {
    logo: 'sonarr',
    name: 'Sonarr',
    address: 'http://localhost:8989',
    state: 'connected',
    stateText: 'Connected · 4.0',
    onClick: fn(),
  },
} satisfies Meta<typeof RowService>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {};

export const Selected: Story = { args: { selected: true } };

export const NotSetUp: Story = {
  args: {
    logo: 'plex',
    name: 'Plex',
    address: <span className="text-subtle-foreground">No address yet</span>,
    state: 'not-set-up',
    stateText: 'Not set up',
  },
};

export const Failed: Story = {
  args: { logo: 'radarr', name: 'Radarr', address: 'http://localhost:7878', state: 'failed', stateText: 'Failed: API key refused' },
};

export const Testing: Story = {
  args: { logo: 'rtorrent', name: 'rTorrent', address: 'https://seedbox.example/xmlrpc', state: 'testing', stateText: 'Testing' },
};

export const Unsaved: Story = {
  args: { logo: 'rtorrent', name: 'rTorrent', address: 'https://seedbox.example/xmlrpc', state: 'unsaved', stateText: 'Unsaved edits' },
};

// The setup wizard shows what the service is for until it has an address.
export const InSetupWizard: Story = {
  args: { logo: 'jellyfin', name: 'Jellyfin', address: 'Media server', state: 'not-set-up', stateText: 'Needs API key' },
};
