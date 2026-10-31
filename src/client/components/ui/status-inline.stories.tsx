import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusInline } from '@/components/ui/status-inline';

const meta = {
  title: 'Badges, marks & status/StatusInline',
  component: StatusInline,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-2905' } },
  args: { status: 'sent', children: 'Jellyfin “Living room” answered · 10.10.3' },
} satisfies Meta<typeof StatusInline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sent: Story = {};

export const Failed: Story = { args: { status: 'failed', children: "Sonarr didn't answer." } };

export const Busy: Story = { args: { status: 'busy', children: 'Reading health…' } };
