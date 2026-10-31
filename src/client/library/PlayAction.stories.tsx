import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { LibraryPosterCard } from '@/components/ui/library-poster-card';
import { PlayAction } from '@/library/PlayAction';
import { plexWebUrl } from '@/library/watch';

// Sample poster built in place, so the story needs no image server.
const poster = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="630"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a7b4e"/><stop offset="1" stop-color="#262e18"/></linearGradient></defs><rect width="420" height="630" fill="url(#g)"/></svg>',
)}`;

// Shown in the poster card's action slot, always visible as in Continue Watching.
const meta = {
  title: 'Cards & posters/PlayAction',
  component: PlayAction,
  args: {
    mode: 'desktop',
    label: 'Play S3 E5',
    name: 'Severance',
    resumeAtMs: null,
    plexUrl: plexWebUrl('abc123', '4521'),
    onPlay: fn(async () => undefined),
  },
  render: (args) => (
    <LibraryPosterCard href="/series/87" onClick={(event) => event.preventDefault()} poster={poster} title="Severance" meta="S3 E5 · 28 min" actionAlwaysVisible action={<PlayAction {...args} />} />
  ),
} satisfies Meta<typeof PlayAction>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Desktop app: plays straight away. */
export const Play: Story = {};

/** Desktop app with a saved position: Resume opens the Start menu. */
export const Resume: Story = {
  args: { label: 'Resume', resumeAtMs: 21 * 60_000 },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Resume: Severance' }));
    await within(document.body).findByRole('menuitem', { name: 'Resume from 21:00' });
  },
};

/** Waiting for the player: spinner in place of the play icon, words and width unchanged. Esc cancels. */
export const Waiting: Story = {
  args: { onPlay: fn(() => new Promise(() => undefined)) },
  play: async ({ canvas, args, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Play S3 E5: Severance' });
    await userEvent.click(button);
    await expect(args.onPlay).toHaveBeenCalledWith('start', expect.any(AbortSignal));
    await expect(button).toHaveAttribute('aria-busy', 'true');
  },
};

/** Plain browser with Plex: opens the item on app.plex.tv in a new tab. */
export const PlayInPlex: Story = { args: { mode: 'plex-web' } };
