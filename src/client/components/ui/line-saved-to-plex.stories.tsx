import type { Meta, StoryObj } from '@storybook/react-vite';
import { LineSavedToPlex } from '@/components/ui/line-saved-to-plex';

const meta = {
  title: 'Overlays & bars/LineSavedToPlex',
  component: LineSavedToPlex,
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=106-1122' } },
  tags: ['autodocs'],
  // It sits at the foot of a dark player menu, 320 px wide.
  decorators: [(Story) => <div className="w-80 rounded-lg bg-bar p-1"><Story /></div>],
  args: { children: 'Saved to Plex for this episode, so your other Plex apps play it the same way.' },
} satisfies Meta<typeof LineSavedToPlex>;

export default meta;
type Story = StoryObj<typeof meta>;

// Audio menu (player.pen state 5).
export const Audio: Story = {};

// Subtitles menu (state 6).
export const Subtitles: Story = { args: { children: 'Saved to Plex for this episode, so your other Plex apps show the same subtitles.' } };

// Subtitle timing (state 7).
export const SubtitleTiming: Story = { args: { children: 'Saved to Plex on this subtitle track.' } };
