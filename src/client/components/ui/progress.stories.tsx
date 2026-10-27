import type { Meta, StoryObj } from '@storybook/react-vite';
import { Progress } from '@/components/ui/progress';

const meta = {
  title: 'UI/Progress',
  component: Progress,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-378' } },
  // The bar fills its parent; the Downloads row gives it 120 px.
  decorators: [(Story) => <div className="w-30"><Story /></div>],
  args: { value: 42.7, 'aria-label': 'Severance S02E01' },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Downloading: Story = {};

export const Stalled: Story = { args: { tone: 'stalled', value: 63 } };

export const Done: Story = { args: { tone: 'done', value: 100 } };

// Lime on the black downloads bar, 48 px there.
export const OnDark: Story = {
  args: { tone: 'on-dark', value: 64, className: 'w-12' },
  decorators: [(Story) => <div className="flex h-(--livebar) items-center bg-bar px-4"><Story /></div>],
};

export const Empty: Story = { args: { value: 0 } };
