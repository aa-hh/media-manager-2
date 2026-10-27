import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ToggleBookmark } from '@/components/ui/toggle-bookmark';

const meta = {
  title: 'Actions & inputs/ToggleBookmark',
  component: ToggleBookmark,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-3497' } },
  args: { state: 'all', onToggle: fn() },
} satisfies Meta<typeof ToggleBookmark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const All: Story = {};

export const None: Story = { args: { state: 'none' } };

export const Mixed: Story = { args: { state: 'mixed' } };

export const Disabled: Story = { args: { onToggle: undefined } };

export const DisabledMixed: Story = { args: { state: 'mixed', onToggle: undefined } };
