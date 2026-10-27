import type { Meta, StoryObj } from '@storybook/react-vite';
import { Scrim } from '@/components/ui/scrim';

const meta = {
  title: 'Overlays & bars/Scrim',
  component: Scrim,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-5349' } },
  // A page behind the scrim, so the dimming shows.
  decorators: [
    (Story) => (
      <div className="flex h-96 flex-col gap-2 p-10">
        <h1 className="font-ui text-4xl text-foreground">Downloads</h1>
        <p className="font-ui text-sm text-muted-foreground">Being handled by media-manager-2</p>
        <Story />
      </div>
    ),
  ],
  args: {},
} satisfies Meta<typeof Scrim>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
