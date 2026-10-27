import type { Meta, StoryObj } from '@storybook/react-vite';
import { BookmarkX, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/ui/logo';

const meta = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: { children: 'Not in library' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};

export const Strong: Story = { args: { variant: 'strong', children: 'In library' } };

export const Best: Story = { args: { variant: 'best', children: 'Best' } };

export const Live: Story = { args: { variant: 'live', percent: 42, children: '2 downloading' } };

export const Risk: Story = { args: { variant: 'risk', children: 'Deleted' } };

export const Warning: Story = { args: { variant: 'warning', children: 'Missing 3 episodes' } };

export const Outline: Story = { args: { variant: 'outline', children: 'Not out yet' } };

export const Plain: Story = { args: { variant: 'plain', icon: <Check aria-hidden="true" />, children: 'In library' } };

export const Inline: Story = {
  args: {
    variant: 'inline',
    children: (
      <>
        <Logo name="sonarr" alt="" />
        Sonarr
      </>
    ),
  },
};

export const InlineValue: Story = { args: { variant: 'inline-value', children: 24 } };

export const WithIcon: Story = { args: { icon: <BookmarkX aria-hidden="true" />, children: 'Not monitored' } };

export const WithSpinner: Story = { args: { spinner: true, children: 'Sending' } };
