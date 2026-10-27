import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { SettingsPlayback } from '@/components/ui/settings-playback';

const meta = {
  title: 'Rows — activity & settings/SettingsPlayback',
  component: SettingsPlayback,
  tags: ['autodocs'],
  decorators: [(Story) => <div className="p-6"><Story /></div>],
  args: {
    loadAhead: '2 min',
    options: ['30 s', '1 min', '2 min', '5 min', '10 min'].map((value) => ({ value, label: value })),
    onLoadAheadChange: fn(),
  },
} satisfies Meta<typeof SettingsPlayback>;

export default meta;
type Story = StoryObj<typeof meta>;

// player.pen U9Z5wS: Load ahead at 2 min.
export const Default: Story = {};
