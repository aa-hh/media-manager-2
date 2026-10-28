import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { plexWebUrl } from '@/library/watch';
import { PlayStill, TitlePlayLine } from '@/title/TitlePlay';

const plexUrl = plexWebUrl('abc123', '4521');
const still = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="144" height="80"><defs><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="#1f3329"/><stop offset="1" stop-color="#4b5a3c"/></linearGradient></defs><rect width="144" height="80" fill="url(#g)"/></svg>',
)}`;

// The header's Play line on the movie and show pages (title.pen NIjoo, p6VuR); room under it for the resume menu.
const meta = {
  title: 'Headers & navigation/TitlePlayLine',
  component: TitlePlayLine,
  decorators: [(Story) => <div className="h-56 p-4"><Story /></div>],
  args: {
    mode: 'desktop',
    name: 'Severance',
    plexUrl,
    play: { label: 'Resume S2 E4', line1: 'Stopped at 21:00 · S2 E4 · Woe’s Hollow', line2: '31 min left of 52 min', resumeAtMs: 21 * 60_000 },
    onPlay: fn(async () => undefined),
  },
} satisfies Meta<typeof TitlePlayLine>;

export default meta;
type Story = StoryObj<typeof meta>;

/** NIjoo, OkR0H: a saved position; Resume opens the resume menu. */
export const Resume: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Resume S2 E4: Severance' }));
    await userEvent.click(await within(document.body).findByRole('menuitem', { name: 'Resume from 21:00' }));
    await expect(args.onPlay).toHaveBeenCalledWith('resume', expect.any(AbortSignal));
  },
};

/** No saved position: Play S3 E5 plays at once. */
export const PlayNext: Story = {
  args: { play: { label: 'Play S3 E5', line1: 'S3 E5 · Attila', line2: '56 min', resumeAtMs: null } },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Play S3 E5: Severance' }));
    await expect(args.onPlay).toHaveBeenCalledWith('start', expect.any(AbortSignal));
  },
};

/** p6VuR: a movie with two versions; Play starts the highest quality. */
export const Movie: Story = {
  args: { name: 'Dune: Part Two', play: { label: 'Play', line1: '2 h 46 min · plays 2160p WEB-DL', line2: 'Highest quality of 2 versions', resumeAtMs: null } },
};

/** A movie with one version: no second line, so the first sits level with Play. */
export const MovieOneVersion: Story = {
  args: { name: 'Dune: Part Two', play: { label: 'Play', line1: '2 h 46 min · plays 2160p WEB-DL', resumeAtMs: null } },
};

/** Plain browser with Plex: Play in Plex opens the item on app.plex.tv; no resume menu. */
export const PlayInPlex: Story = { args: { mode: 'plex-web' } };

/** NIjoo E04, wnNt9: the next episode's still glows; with a saved position it opens the resume menu under it. */
export const StillResume: Story = {
  render: (args) => <PlayStill mode="desktop" code="E04" image={still} next watched={60} resumeAtMs={21 * 60_000} plexUrl={plexUrl} onStart={args.onPlay} />,
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Resume E04' }));
    await userEvent.click(await within(document.body).findByRole('menuitem', { name: 'Play from the start' }));
    await expect(args.onPlay).toHaveBeenCalledWith('start', expect.any(AbortSignal));
  },
};

/** L91tSr: no saved position; Enter on the still plays at once. */
export const StillPlay: Story = {
  render: (args) => <PlayStill mode="desktop" code="E06" image={still} resumeAtMs={null} plexUrl={plexUrl} onStart={args.onPlay} />,
  play: async ({ canvas, args, userEvent }) => {
    canvas.getByRole('button', { name: 'Play E06' }).focus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onPlay).toHaveBeenCalledWith('start', expect.any(AbortSignal));
  },
};

/** OJb8g, or Jellyfin: the still shows but does not play. */
export const StillNoPlay: Story = {
  render: () => <PlayStill mode="none" code="E02" image={still} noFile resumeAtMs={null} plexUrl={plexUrl} onStart={fn()} />,
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};
