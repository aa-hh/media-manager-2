import type { Meta, StoryObj } from '@storybook/react-vite';
import { MarkPendingChange } from '@/components/ui/mark-pending-change';

const meta = {
  title: 'UI/MarkPendingChange',
  component: MarkPendingChange,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-865' } },
  args: { from: 'Off', to: 'On', 'aria-label': 'Monitored changing from off to on' },
} satisfies Meta<typeof MarkPendingChange>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutFrom: Story = { args: { from: undefined } };

export const WithoutIcon: Story = { args: { icon: false } };
