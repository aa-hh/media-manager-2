import type { Meta, StoryObj } from '@storybook/react-vite';
import { Play } from 'lucide-react';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MenuResume } from '@/components/ui/menu-resume';

const meta = {
  title: 'Actions & inputs/MenuResume',
  component: MenuResume,
  tags: ['autodocs'],
  // Opened from the header's Resume button, with room under it for the menu.
  decorators: [
    (Story) => (
      <div className="flex h-80 p-4">
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger render={<Button size="large" icon={<Play />}>Resume S2 E4</Button>} />
          <Story />
        </DropdownMenu>
      </div>
    ),
  ],
  args: { resumeAt: '21:00', onResume: fn(), onRestart: fn() },
} satisfies Meta<typeof MenuResume>;

export default meta;
type Story = StoryObj<typeof meta>;

// title.pen OkR0H and wnNt9: a saved position and two versions, the default ticked.
export const TwoVersions: Story = {
  args: {
    versions: [
      { value: '2160p', label: '2160p WEB-DL · 4.2 GB' },
      { value: '720p', label: '720p WEB-DL · 1.4 GB' },
    ],
    version: '2160p',
    onVersionChange: fn(),
  },
};

// One version: only the Start group.
export const OneVersion: Story = {};
