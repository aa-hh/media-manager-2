import type { Meta, StoryObj } from '@storybook/react-vite';
import { Ellipsis, History, RefreshCw, SlidersHorizontal, Trash2 } from 'lucide-react';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const meta = {
  title: 'UI/DropdownMenu',
  component: DropdownMenu,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-4049' } },
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
