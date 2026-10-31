import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { RowSignedInTv } from '@/components/ui/row-signed-in-tv';

const meta = {
  title: 'Rows — activity & settings/RowSignedInTv',
  component: RowSignedInTv,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/dFQMjELOx6ObLS0qOG3NCF?node-id=23-1657' } },
  // Settings lists the rows in this 420 px column.
  decorators: [
    (Story) => (
      <div className="flex w-105 shrink-0 flex-col">
        <Story />
      </div>
    ),
  ],
  args: { name: 'Google TV Streamer', dates: 'Signed in 12 Oct 2026 · Last used today', onSignOut: fn() },
} satisfies Meta<typeof RowSignedInTv>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const UsedEarlier: Story = { args: { name: 'Bedroom TV', dates: 'Signed in 3 Sep 2026 · Last used 18 Oct 2026' } };

export const LongName: Story = { args: { name: 'Living room Google TV Streamer (4K) by the window' } };

export const SignOutOff: Story = { args: { disabled: true } };
