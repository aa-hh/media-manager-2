import type { Meta, StoryObj } from '@storybook/react-vite';
import { AudioLines, Captions, Ellipsis, History, RefreshCw, SlidersHorizontal, Trash2 } from 'lucide-react';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { LineSavedToPlex } from '@/components/ui/line-saved-to-plex';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuToggleGroup,
  DropdownMenuToggleGroupItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const meta = {
  title: 'Actions & inputs/DropdownMenu',
  component: DropdownMenu,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=106-673' } },
  // Room under the trigger so the open menu sits inside the story.
  decorators: [
    (Story) => (
      <div className="flex h-80 justify-center p-4">
        <Story />
      </div>
    ),
  ],
  args: { defaultOpen: true, onOpenChange: fn() },
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

// The title page's More actions menu.
export const TitleActions: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger render={<Button variant="outline" size="large" iconOnly icon={<Ellipsis />} aria-label="More actions" />} />
      <DropdownMenuContent>
        <DropdownMenuItem icon={<RefreshCw />} onClick={fn()}>Refresh</DropdownMenuItem>
        <DropdownMenuItem icon={<History />} onClick={fn()}>History</DropdownMenuItem>
        <DropdownMenuItem icon={<SlidersHorizontal />} onClick={fn()}>Change monitoring</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Trash2 />} destructive onClick={fn()}>Delete show</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const DisabledItem: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger render={<Button variant="outline" size="large" iconOnly icon={<Ellipsis />} aria-label="More actions" />} />
      <DropdownMenuContent>
        <DropdownMenuItem icon={<RefreshCw />} disabled>Refresh</DropdownMenuItem>
        <DropdownMenuItem icon={<History />} onClick={fn()}>History</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Trash2 />} destructive onClick={fn()}>Delete movie</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

// A Downloads row's actions, aligned to the row's right edge.
export const RowActions: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger render={<Button variant="ghost" size="row" iconOnly icon={<Ellipsis className="text-muted-foreground" />} aria-label="Actions for Dune: Part Two" />} />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={fn()}>Grab now</DropdownMenuItem>
        <DropdownMenuItem onClick={fn()}>Import by hand</DropdownMenuItem>
        <DropdownMenuItem onClick={fn()}>Remove from downloads</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

// The library's Poster fields menu: a labelled group of rows that keep a check.
export const CheckboxItems: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger render={<Button variant="menu">Poster fields</Button>} />
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuGroupLabel>Poster fields</DropdownMenuGroupLabel>
          <DropdownMenuCheckboxItem checked onCheckedChange={fn()}>Year</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked onCheckedChange={fn()}>Progress</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={false} onCheckedChange={fn()}>Size</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={false} onCheckedChange={fn()}>Quality profile</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={false} onCheckedChange={fn()}>Date added</DropdownMenuCheckboxItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

// The player's dark Audio menu (player.pen GrqIz state 5): a radio group of tracks and the Saved to Plex line.
export const OnDark: Story = {
  decorators: [(Story) => <div className="flex h-80 items-end justify-center bg-black p-4"><Story /></div>],
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger render={<Button variant="on-dark" icon={<AudioLines />} aria-label="Audio: Japanese 5.1">Japanese 5.1</Button>} />
      <DropdownMenuContent onDark side="top" align="end" sideOffset={8} className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuGroupLabel>Audio</DropdownMenuGroupLabel>
          <DropdownMenuRadioGroup defaultValue="ja">
            <DropdownMenuRadioItem value="ja">Japanese · Dolby Digital 5.1</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="en">English · Dolby Digital 5.1</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="ja-ad">Japanese · Audio description, stereo</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <LineSavedToPlex>Saved to Plex for this episode, so your other Plex apps play it the same way.</LineSavedToPlex>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

const textSizeMenu = (disabled: boolean) => (args: Story['args']) => (
  <DropdownMenu {...args}>
    <DropdownMenuTrigger render={<Button variant="on-dark" icon={<Captions />} aria-label="Subtitles: English">English</Button>} />
    <DropdownMenuContent onDark side="top" align="end" sideOffset={8} className="w-80">
      <DropdownMenuGroup>
        <DropdownMenuGroupLabel>Text size</DropdownMenuGroupLabel>
        <div className="px-2 pt-0.5 pb-1.5">
          <DropdownMenuToggleGroup defaultValue="Large" disabled={disabled}>
            {['Tiny', 'Small', 'Normal', 'Large', 'Huge'].map((label) => <DropdownMenuToggleGroupItem key={label} value={label}>{label}</DropdownMenuToggleGroupItem>)}
          </DropdownMenuToggleGroup>
        </div>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);

// The toggle group in a dark menu: the Subtitles menu's Text size row, Large chosen (player file 5:251).
export const ToggleGroupOnDark: Story = {
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/5XDOiiHT4DNqDRgYkgbe5y/media-manager-2----player?node-id=2-165' } },
  decorators: [(Story) => <div className="flex h-40 items-end justify-center bg-black p-4"><Story /></div>],
  render: textSizeMenu(false),
};

// Disabled, as with subtitles Off or a picture subtitle: the row at 40 %, the saved size still marked.
export const ToggleGroupOnDarkDisabled: Story = {
  parameters: ToggleGroupOnDark.parameters,
  decorators: ToggleGroupOnDark.decorators,
  render: textSizeMenu(true),
};
