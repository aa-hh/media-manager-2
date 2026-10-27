import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChipFit } from '@/components/ui/chip-fit';

const meta = {
  title: 'UI/ChipFit',
  component: ChipFit,
  tags: ['autodocs'],
  args: { kind: 'score', children: '+150' },
} satisfies Meta<typeof ChipFit>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Score: Story = {};

export const Negative: Story = { args: { kind: 'negative', children: '−20' } };

export const Best: Story = { args: { kind: 'best', children: '+1250' } };

export const BestStar: Story = { args: { kind: 'best-star', children: undefined } };

export const Rejected: Story = { args: { kind: 'rejected', children: undefined, tooltip: 'Not an upgrade for existing episode file(s)' } };
