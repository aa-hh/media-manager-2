import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { Fact, FactRow } from '@/components/ui/fact';

const meta = {
  title: 'UI/Fact',
  component: Fact,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-1251' } },
  // Fact and FactRow are dt/dd pairs; the screens place them inside a <dl>.
  decorators: [(Story) => <dl className="flex flex-wrap gap-x-8 gap-y-3 py-2"><Story /></dl>],
  args: { label: 'Ratio', children: '2.41' },
} satisfies Meta<typeof Fact>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// The tracker stats line in a tracker's settings.
export const TrackerStats: Story = {
  render: () => (
    <>
      <Fact label="Ratio">2.41</Fact>
      <Fact label="Required ratio">0.60</Fact>
      <Fact label="Upload">1.8 TB</Fact>
      <Fact label="Download">764.2 GB</Fact>
      <Fact label="Buffer">1.1 TB</Fact>
      <Fact label="Seeding">312</Fact>
      <Fact label="Bonus">48,210</Fact>
      <Fact label="Hit and runs, lifetime">0</Fact>
    </>
  ),
};

const rows: Decorator = (Story) => <dl className="flex w-160 flex-col"><Story /></dl>;

export const Row: Story = {
  decorators: [rows],
  render: () => <FactRow label="How often">Every 5 minutes</FactRow>,
};

export const RowWithNote: Story = {
  decorators: [rows],
  render: () => <FactRow label="Last checked" note="2 minutes ago, every 5 min">Today 14:32</FactRow>,
};

export const RowWithProgress: Story = {
  decorators: [rows],
  render: () => <FactRow label="Disk" progress={64} note="limit 90%">64%</FactRow>,
};

export const RowOverLimit: Story = {
  decorators: [rows],
  render: () => <FactRow label="Disk" progress={96} overLimit note="limit 90%">96%</FactRow>,
};
