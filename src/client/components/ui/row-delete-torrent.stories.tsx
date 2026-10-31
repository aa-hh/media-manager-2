import type { Meta, StoryObj } from '@storybook/react-vite';
import { FileVideo } from 'lucide-react';
import { fn } from 'storybook/test';
import { formatBytes } from '@/downloads/model';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Logo } from '@/components/ui/logo';
import { RowDeleteTorrent } from '@/components/ui/row-delete-torrent';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

// The Keep seeding / Remove torrent choice the delete dialog puts at the right of each torrent row.
const torrentChoice = (risky: boolean) => (
  <ToggleGroup value="keep" onValueChange={fn()} aria-label="Torrent">
    <ToggleGroupItem value="keep">Keep seeding</ToggleGroupItem>
    <ToggleGroupItem value="remove" risk={risky}>Remove torrent</ToggleGroupItem>
  </ToggleGroup>
);

const meta = {
  title: 'Rows — activity & settings/RowDeleteTorrent',
  component: RowDeleteTorrent,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-10060' } },
  // The delete dialog lists these rows in a column; w-128 is the dialog's 560 px less its 24 px padding.
  decorators: [
    (Story) => (
      <div className="flex w-128 flex-col gap-2 bg-card">
        <Story />
      </div>
    ),
  ],
  args: {
    lead: <Logo name="blutopia" alt="" />,
    marks: 1,
    name: 'Severance.S02E05.Trojans.Horse.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX',
    size: formatBytes(3_412_000_000),
    holds: 'Holds E05',
    advice: { look: 'keep', verdict: 'Keep seeding', reason: 'seeded 41 h of 168 h; 127 h left' },
    action: torrentChoice(true),
  },
} satisfies Meta<typeof RowDeleteTorrent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Keep: Story = {};

export const Safe: Story = {
  args: {
    advice: { look: 'safe', verdict: 'Safe to remove', reason: 'seeded 212 h; Blutopia asks 168 h' },
    action: torrentChoice(false),
  },
};

export const Unconfirmed: Story = {
  args: {
    lead: null,
    marks: 0,
    advice: { look: 'unconfirmed', verdict: "Can't confirm yet", reason: 'No rule is set for this tracker yet.' },
  },
};

export const SeasonPackImportedByCopy: Story = {
  args: {
    name: 'Severance.S02.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX',
    size: formatBytes(34_870_000_000),
    holds: 'Season pack · holds E01, E02, E03, E04, E05, E06 and 4 more',
    label: <Badge>imported by copy</Badge>,
  },
};

export const UpgradedAway: Story = {
  args: {
    holds: 'Upgraded away; backs no library file',
    advice: { look: 'safe', verdict: 'Safe to remove', reason: 'seeded 212 h; Blutopia asks 168 h' },
    action: (
      <label className="flex shrink-0 items-center gap-2 px-1 font-ui text-[13px] font-medium text-foreground">
        <Checkbox checked={false} onCheckedChange={fn()} />
        Remove torrent
      </label>
    ),
  },
};

export const Locked: Story = { args: { locked: 'This torrent also holds files of this show that this delete keeps.' } };

export const SecondVersion: Story = {
  args: {
    lead: (
      <>
        <Checkbox checked onCheckedChange={fn()} aria-label="Delete Severance.S02E05.Trojans.Horse.2160p.ATVP.WEB-DL.DDP5.1.DV.HDR.H.265-FLUX" />
        <Logo name="blutopia" alt="" />
      </>
    ),
    marks: 2,
    name: 'Severance.S02E05.Trojans.Horse.2160p.ATVP.WEB-DL.DDP5.1.DV.HDR.H.265-FLUX',
    size: formatBytes(9_870_000_000),
    holds: 'Second version of E05',
  },
};

export const LibraryFileWithoutTorrent: Story = {
  args: {
    lead: <FileVideo aria-hidden="true" className="text-subtle-foreground" />,
    marks: 1,
    name: 'Severance - S02E05 - Trojan\'s Horse WEBDL-1080p.mkv',
    holds: "The file couldn't be linked to a torrent.",
    advice: undefined,
    action: undefined,
  },
};
