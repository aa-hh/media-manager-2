import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlayerScrubPreview } from '@/components/ui/player-scrub-preview';

const still = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><defs><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="#1f3329"/><stop offset="1" stop-color="#4b5a3c"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/></svg>',
)}`;

const meta = {
  title: 'Overlays & bars/PlayerScrubPreview',
  component: PlayerScrubPreview,
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=109-267' } },
  tags: ['autodocs'],
  decorators: [(Story) => <div className="bg-black p-6"><Story /></div>],
  args: { image: still, time: '40:45', chapter: 'Chapter 6 · The council' },
} satisfies Meta<typeof PlayerScrubPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

// player.pen state 11.
export const WithChapter: Story = {};

// A file without chapters: no chapter name.
export const NoChapters: Story = { args: { chapter: undefined } };
