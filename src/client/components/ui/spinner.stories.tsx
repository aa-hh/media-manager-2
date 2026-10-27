import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spinner } from '@/components/ui/spinner';

const meta = {
  title: 'UI/Spinner',
  component: Spinner,
  tags: ['autodocs'],
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = { args: { className: 'size-3' } };

export const OnDark: Story = {
  args: { className: 'text-bar-foreground' },
  decorators: [(Story) => <div className="inline-flex rounded-sm bg-bar p-3"><Story /></div>],
};
