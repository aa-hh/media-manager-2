import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { StripStillMissing } from '@/components/ui/strip-still-missing';

const meta = {
  title: 'UI/StripStillMissing',
  component: StripStillMissing,
  tags: ['autodocs'],
  args: {
    lead: 'Aired, still missing',
    children: 'Severance S02E03 · The Bear S03E01 · Slow Horses S04E02',
  },
} satisfies Meta<typeof StripStillMissing>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithAction: Story = {
  args: {
    lead: 'Still missing',
    children: 'S02E03 · S02E05 · S02E07',
    action: { label: 'Next missing', kbd: 'N', onClick: fn() },
  },
};

export const ActionDisabled: Story = {
  args: {
    lead: 'Still missing',
    children: 'S02E03 · S02E05 · S02E07',
    action: { label: 'Next missing', kbd: 'N', onClick: fn(), disabled: true },
  },
};
