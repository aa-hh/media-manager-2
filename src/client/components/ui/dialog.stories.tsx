import type { Meta, StoryObj } from '@storybook/react-vite';
import { Check, RotateCw } from 'lucide-react';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { CardChoice } from '@/components/ui/card-choice';
import { Dialog } from '@/components/ui/dialog';
import { RadioGroup } from '@/components/ui/radio';

const meta = {
  title: 'UI/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  args: {
    open: true,
    onOpenChange: fn(),
    title: 'Remove from downloads?',
    subject:
      'Severance S02E01 · WEBDL-1080p · Severance.S02E01.Hello.Ms.Cobel.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX. The torrent keeps seeding in rTorrent; media-manager-2 never removes a torrent from here.',
    children: (
      <RadioGroup defaultValue="blocklist" className="flex flex-col gap-2">
        <CardChoice value="blocklist" title="Blocklist only" description="Sonarr won't grab this release again." />
        <CardChoice value="blocklist_search" title="Blocklist and search again" description="Sonarr won't grab it again and searches for another release now." />
        <CardChoice value="keep" title="Don't blocklist" description="Sonarr may grab this same release again." />
      </RadioGroup>
    ),
    actions: (
      <>
        <Button variant="outline" onClick={fn()}>Cancel</Button>
        <Button variant="destructive" size="large" onClick={fn()}>Remove from downloads, keep seeding, blocklist</Button>
      </>
    ),
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithCallout: Story = {
  args: {
    callout: (
      <Callout look="warning" title="Hit and run: Keep seeding">
        Blutopia needs 31 hours to avoid a hit and run
      </Callout>
    ),
  },
};

export const Sending: Story = {
  args: {
    actions: (
      <>
        <Button variant="outline" onClick={fn()}>Cancel</Button>
        <Button variant="destructive" size="large" loading>Remove from downloads, keep seeding, blocklist</Button>
      </>
    ),
  },
};

// Pick a release's decision dialog: Cancel carries the Esc hint, so the close button drops its own.
export const EscOnCancel: Story = {
  args: {
    title: 'This is already in your library',
    subject:
      "Grabbing Severance.S02E04.Woes.Hollow.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX. Your WEBDL-720p · NTb · 1.4 GB. The current file's torrent keeps seeding either way.",
    escOnCancel: true,
    children: (
      <RadioGroup defaultValue="replace" aria-label="Replace or keep as a second version" className="flex flex-col gap-2">
        <CardChoice value="replace" kbd="1" title="Replace tracked version" description="The new release becomes the tracked file, even at lower quality, and is kept from automatic upgrades." />
        <CardChoice value="second" kbd="2" title="Keep as second version" description="Keeps both files side by side in Plex." />
      </RadioGroup>
    ),
    actions: (
      <>
        <Button variant="outline" kbd="Esc" data-cancel="" onClick={fn()}>Cancel</Button>
        <Button size="large" kbd="↵" onClick={fn()}>Grab and replace the current file</Button>
      </>
    ),
  },
};

export const FooterCallout: Story = {
  args: {
    ...EscOnCancel.args,
    footerCallout: <Callout look="risk" title="Sonarr did not take the grab. Try again." />,
  },
};

// The second-version delete dialog: subject fixed under the title, choices scroll between lines.
export const ScrollEdges: Story = {
  args: {
    title: 'Delete the 720p second version?',
    subject: 'S02E04 · 720p · 1.4 GB. The 1080p tracked version is not touched.',
    scrollEdges: true,
    children: (
      <RadioGroup defaultValue="keep" className="flex flex-col gap-2">
        <CardChoice value="keep" title="Keep seeding the torrent" description="Keeping it is the safe choice." />
        <CardChoice value="remove" title="Remove the torrent too" description="The hit and run rule could not be checked." />
      </RadioGroup>
    ),
    footerCallout: (
      <Callout look="warning" title="No seeding record, so keep the torrent to be safe.">
        rTorrent has no history for this torrent, so the hit and run rule can't be checked.
      </Callout>
    ),
    actions: (
      <>
        <Button variant="outline" onClick={fn()}>Cancel</Button>
        <Button variant="destructive" size="large" onClick={fn()}>Delete file, keep seeding</Button>
      </>
    ),
  },
};

export const ScrollEdgesFailed: Story = {
  args: {
    title: 'Delete Severance from Sonarr?',
    subject: undefined,
    scrollEdges: true,
    children: undefined,
    footerCallout: (
      <Callout title="Couldn't check what this delete would touch." action={<Button variant="outline" icon={<RotateCw />} onClick={fn()}>Try again</Button>}>
        media-manager-2 did not answer. Try again.
      </Callout>
    ),
    actions: (
      <>
        <Button variant="outline" onClick={fn()}>Cancel</Button>
        <Button variant="destructive" size="large" disabled>Delete</Button>
      </>
    ),
  },
};

// The add dialog: 800 px, large title, no key hints.
export const Wide: Story = {
  args: {
    wide: true,
    title: <>Add <span className="font-extrabold">Severance</span></>,
    subject: undefined,
    children: <p className="font-ui text-lg text-foreground">Sonarr is searching 19 aired episodes.</p>,
    actions: (
      <>
        <Button variant="ghost" size="large" onClick={fn()}>Cancel</Button>
        <Button size="large" icon={<Check />} onClick={fn()}>Confirm selection</Button>
      </>
    ),
  },
};

export const WideRefused: Story = {
  args: {
    ...Wide.args,
    footerCallout: <Callout title="Severance is already in your library" />,
    actions: (
      <>
        <Button variant="ghost" size="large" onClick={fn()}>Cancel</Button>
        <Button size="large" onClick={fn()}>Open in library</Button>
      </>
    ),
  },
};
