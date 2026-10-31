import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { InputSearch } from '@/components/ui/input-search';
import { NavigationPhone } from '@/components/ui/navigation-phone';

const meta = {
  title: 'Headers & navigation/NavigationPhone',
  component: NavigationPhone,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=13-5947' } },
  // A phone-width column, as the bar would sit at the top of a phone screen.
  decorators: [(Story) => <div className="w-[390px]"><Story /></div>],
  args: { title: 'Library', onBack: fn(), onMore: fn() },
} satisfies Meta<typeof NavigationPhone>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSearch: Story = {
  args: {
    search: <InputSearch type="search" aria-label="Search library, Sonarr and Radarr" placeholder="Search movies and TV shows" defaultValue="" onClear={fn()} />,
  },
};

export const TitleOnly: Story = { args: { onBack: undefined, onMore: undefined } };

export const LongTitle: Story = { args: { title: 'Everything Everywhere All at Once' } };
