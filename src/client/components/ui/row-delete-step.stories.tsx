import type { Meta, StoryObj } from '@storybook/react-vite';
import { RowDeleteStep } from '@/components/ui/row-delete-step';

const meta = {
  title: 'UI/RowDeleteStep',
  component: RowDeleteStep,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-8538' } },
  // The delete results dialog stacks the steps in this column; w-128 is the dialog's 560 px less its 24 px padding.
  decorators: [
    (Story) => (
      <div className="w-128 bg-card">
        <div className="flex w-full flex-col">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    look: 'done',
    text: 'Removed Severance.S02.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX and its data',
    why: 'You chose to remove it.',
  },
} satisfies Meta<typeof RowDeleteStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Done: Story = {};

export const Kept: Story = {
  args: {
    look: 'kept',
    text: 'Kept Severance.S02.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX seeding',
    why: 'Blutopia asks 168 h; seeded 41 h so far.',
  },
};

export const Failed: Story = {
  args: {
    look: 'failed',
    text: "Couldn't remove Severance.S02.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX",
    why: 'rTorrent is not answering, so its torrent list may be out of date.',
  },
};

export const WithoutWhy: Story = { args: { look: 'done', text: 'Unmonitored Season 2', why: null } };
