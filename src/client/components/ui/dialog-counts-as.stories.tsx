import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { CardChoice } from '@/components/ui/card-choice';
import { Dialog } from '@/components/ui/dialog';
import { DialogCountsAs } from '@/components/ui/dialog-counts-as';
import { SelectContent, SelectItem } from '@/components/ui/dropdown-menu';
import { RadioGroup } from '@/components/ui/radio';
import { Select, SelectTrigger } from '@/components/ui/select-trigger';

const episodes = [
  'E01 Hello, Ms. Cobel',
  'E02 Goodbye, Mrs. Selvig',
  'E03 Who Is Alive?',
  "E04 Woe's Hollow",
  "E05 Trojan's Horse",
  'E06 Attila',
  'E07 Chikhai Bardo',
  'E08 Sweet Vitriol',
  'E09 The After Hours',
  'E10 Cold Harbor',
];

const meta = {
  title: 'UI/DialogCountsAs',
  component: DialogCountsAs,
  tags: ['autodocs'],
  // It sits under the choice cards in Pick a release's decision dialog, whose px-3 it lines up with.
  decorators: [
    (Story) => (
      <Dialog
        open
        onOpenChange={fn()}
        title="This is already in your library"
        subject="Grabbing Severance.S02E08.Sweet.Vitriol.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX. Your WEBDL-720p · NTb · 1.4 GB. The current file's torrent keeps seeding either way."
        escOnCancel
        actions={(
          <>
            <Button variant="outline" kbd="Esc" data-cancel="" onClick={fn()}>Cancel</Button>
            <Button size="large" kbd="↵" onClick={fn()}>Grab and replace the current file</Button>
          </>
        )}
      >
        <RadioGroup defaultValue="replace" aria-label="Replace or keep as a second version" className="flex flex-col gap-2">
          <CardChoice value="replace" kbd="1" title="Replace tracked version" description="The new release becomes the tracked file, even at lower quality, and is kept from automatic upgrades." />
          <CardChoice value="second" kbd="2" title="Keep as second version" description="Keeps both files side by side in Plex." />
        </RadioGroup>
        <Story />
      </Dialog>
    ),
  ],
  args: {
    open: false,
    onOpenChange: fn(),
    summary: 'Season 2 · E08 Sweet Vitriol',
    season: 'Season 2',
    select: (
      <Select value="E08 Sweet Vitriol" onValueChange={fn()}>
        <SelectTrigger variant="inline" size="sm" aria-label="Episode">E08 Sweet Vitriol</SelectTrigger>
        <SelectContent>
          {episodes.map((episode) => <SelectItem key={episode} value={episode}>{episode}</SelectItem>)}
        </SelectContent>
      </Select>
    ),
    help: 'The season comes from the release name. Pick the episode Sonarr files it as.',
  },
} satisfies Meta<typeof DialogCountsAs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const Open: Story = { args: { open: true } };
