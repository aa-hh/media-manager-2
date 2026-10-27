import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ToggleBookmark } from '@/components/ui/toggle-bookmark';

const meta = {
  title: 'UI/ToggleBookmark',
  component: ToggleBookmark,
  tags: ['autodocs'],
  args: { state: 'all', onToggle: fn() },
} satisfies Meta<typeof ToggleBookmark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const All: Story = {};

export const None: Story = { args: { state: 'none' } };

export const Mixed: Story = { args: { state: 'mixed' } };

export const Disabled: Story = { args: { onToggle: undefined } };

export const DisabledMixed: Story = { args: { state: 'mixed', onToggle: undefined } };
