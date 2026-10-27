import type { Meta, StoryObj } from '@storybook/react-vite';
import { MarkProper } from '@/components/ui/mark-proper';

const meta = {
  title: 'UI/MarkProper',
  component: MarkProper,
  tags: ['autodocs'],
  args: { tooltip: 'Proper' },
} satisfies Meta<typeof MarkProper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Proper: Story = {};

export const Repack: Story = { args: { tooltip: 'Repack' } };
