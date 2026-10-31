import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spinner } from '@/components/ui/spinner';

const meta = {
  title: 'Feedback & notices/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-600' } },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = { args: { className: 'size-3' } };

export const OnDark: Story = {
  args: { className: 'text-bar-foreground' },
  decorators: [(Story) => <div className="inline-flex rounded-sm bg-bar p-3"><Story /></div>],
};
