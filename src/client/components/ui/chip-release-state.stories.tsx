import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChipReleaseState } from '@/components/ui/chip-release-state';

const meta = {
  title: 'Badges, marks & status/ChipReleaseState',
  component: ChipReleaseState,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-746' } },
  args: { state: 'grabbed' },
} satisfies Meta<typeof ChipReleaseState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Grabbed: Story = {};

export const Downloading: Story = { args: { state: 'downloading', percent: 64.3 } };

export const Importing: Story = { args: { state: 'importing' } };

export const Stalled: Story = { args: { state: 'stalled', percent: 63 } };

export const ImportBlocked: Story = { args: { state: 'import-blocked' } };

export const Cooldown: Story = { args: { state: 'cooldown' } };

export const Yours: Story = { args: { state: 'yours' } };
