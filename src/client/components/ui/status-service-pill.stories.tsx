import type { Meta, StoryObj } from '@storybook/react-vite';
import { Logo } from '@/components/ui/logo';
import { StatusServicePill } from '@/components/ui/status-service-pill';

const meta = {
  title: 'UI/StatusServicePill',
  component: StatusServicePill,
  tags: ['autodocs'],
  args: { logo: <Logo name="sonarr" alt="" />, name: 'Sonarr', state: 'connected', children: 'Connected · 4.0.10' },
} satisfies Meta<typeof StatusServicePill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {};

export const NotSetUp: Story = { args: { logo: <Logo name="radarr" alt="" />, name: 'Radarr', state: 'not-set-up', children: 'Not set up' } };

export const Failed: Story = { args: { state: 'failed', children: 'Failed: API key refused' } };

export const Testing: Story = { args: { logo: <Logo name="plex" alt="" />, name: 'Plex', state: 'testing', children: 'Testing' } };

export const Unsaved: Story = { args: { logo: <Logo name="radarr" alt="" />, name: 'Radarr', state: 'unsaved', children: 'Unsaved edits' } };

export const Compact: Story = { args: { compact: true } };

export const LookDark: Story = { args: { look: 'dark' } };

// Lime is the finished setup strip, which sits on the black panel.
export const LookLime: Story = {
  args: { look: 'lime' },
  decorators: [(Story) => <div className="inline-flex rounded-lg border border-bar bg-bar px-6 py-5"><Story /></div>],
};

// Settings list rows hide the logo and name with this class and keep only the dot and words.
export const PillOnly: Story = { args: { logo: null, name: null, className: '[&>span:nth-child(-n+2)]:hidden', children: 'Not set up', state: 'not-set-up' } };
