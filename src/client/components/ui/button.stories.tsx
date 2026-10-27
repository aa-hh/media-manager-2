import type { Meta, StoryObj } from '@storybook/react-vite';
import { RefreshCw, Settings } from 'lucide-react';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';

const meta = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  args: { children: 'Check address', onClick: fn() },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Outline: Story = { args: { variant: 'outline', children: 'Try again' } };

export const Ghost: Story = { args: { variant: 'ghost', children: 'Clear filters' } };

export const Destructive: Story = { args: { variant: 'destructive', children: 'Remove tracker' } };

export const OutlineDestructive: Story = { args: { variant: 'outline-destructive', children: 'Remove from downloads' } };

export const Menu: Story = { args: { variant: 'menu', children: 'Poster fields' } };

export const Plex: Story = {
  args: {
    variant: 'plex',
    size: 'large',
    children: (
      <span className="inline-flex items-center gap-2">
        <Logo name="plex" alt="" className="size-4" />
        Log in with Plex
      </span>
    ),
  },
};

export const Jellyfin: Story = {
  args: {
    variant: 'jellyfin',
    size: 'large',
    children: (
      <span className="inline-flex items-center gap-2">
        <Logo name="jellyfin-black" alt="" className="size-4" />
        Log in with Jellyfin
      </span>
    ),
  },
};

export const SizeRow: Story = { args: { variant: 'outline', size: 'row', children: 'Import by hand' } };

export const SizeSm: Story = { args: { size: 'sm' } };

export const SizeLarge: Story = { args: { size: 'large', children: 'Open Downloads' } };

export const Disabled: Story = { args: { disabled: true } };

export const Loading: Story = { args: { loading: true } };

export const WithIcon: Story = { args: { variant: 'ghost', icon: <RefreshCw />, children: 'Check now' } };

export const WithIconLoading: Story = { args: { variant: 'ghost', icon: <RefreshCw />, loading: true, children: 'Check now' } };

export const WithKbd: Story = { args: { variant: 'outline', kbd: 'Esc', children: 'Collapse' } };

export const IconOnly: Story = { args: { variant: 'ghost', iconOnly: true, icon: <Settings />, 'aria-label': 'Settings', children: undefined } };
