import type { Meta, StoryObj } from '@storybook/react-vite';
import { Logo } from '@/components/ui/logo';

const meta = {
  title: 'Icons & logos/Logo',
  component: Logo,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-449' } },
  args: { name: 'sonarr' },
} satisfies Meta<typeof Logo>;

export default meta;
type Story = StoryObj<typeof meta>;

// White logos are drawn for dark backgrounds.
const onDark: Story['decorators'] = [(Story) => <div className="inline-flex rounded-sm bg-bar p-2"><Story /></div>];

export const Sonarr: Story = {};

export const Radarr: Story = { args: { name: 'radarr' } };

export const Rtorrent: Story = { args: { name: 'rtorrent' } };

export const Plex: Story = { args: { name: 'plex' } };

// Only on the black Plex button.
export const PlexGold: Story = { args: { name: 'plex-gold' }, decorators: onDark };

export const PlexWordmark: Story = { args: { name: 'plex-wordmark', className: 'h-5 w-auto' } };

export const PlexAppIcon: Story = { args: { name: 'plex-app-icon', className: 'size-8' } };

export const Jellyfin: Story = { args: { name: 'jellyfin', className: 'size-8' } };

export const JellyfinBlack: Story = { args: { name: 'jellyfin-black', className: 'size-4' } };

export const JellyfinWhite: Story = { args: { name: 'jellyfin-white' }, decorators: onDark };

export const JellyfinSolidBlack: Story = { args: { name: 'jellyfin-solid-black' } };

export const JellyfinSolidWhite: Story = { args: { name: 'jellyfin-solid-white' }, decorators: onDark };

export const JellyfinSolidMonochrome: Story = { args: { name: 'jellyfin-solid-monochrome' } };

export const JellyfinWordmarkLight: Story = { args: { name: 'jellyfin-wordmark-light', className: 'h-6 w-auto' } };

export const JellyfinWordmarkDark: Story = { args: { name: 'jellyfin-wordmark-dark', className: 'h-6 w-auto' }, decorators: onDark };

export const Blutopia: Story = { args: { name: 'blutopia' } };

export const Privatehd: Story = { args: { name: 'privatehd' } };

export const BeyondHd: Story = { args: { name: 'beyond-hd' } };

export const Tmdb: Story = { args: { name: 'tmdb' } };

export const Mdblist: Story = { args: { name: 'mdblist' } };

export const Trakt: Story = { args: { name: 'trakt' } };

// Beside a written name the logo takes alt="", as every row and button in the app does.
export const BesideName: Story = {
  args: { alt: '' },
  render: (args) => (
    <span className="inline-flex items-center gap-1.5 font-ui text-[13px] font-semibold text-foreground">
      <Logo {...args} />
      Sonarr
    </span>
  ),
};
