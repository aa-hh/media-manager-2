import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { OptionRow } from '@/components/ui/option-row';
import { PanelInline } from '@/components/ui/panel-inline';
import { Radio, RadioGroup } from '@/components/ui/radio';
import { Spinner } from '@/components/ui/spinner';

const scopes = [
  { value: 'all', title: 'All episodes', description: 'Every episode, aired and future.' },
  { value: 'future', title: 'Future episodes', description: 'Only episodes that have not aired yet.' },
  { value: 'missing', title: 'Missing episodes', description: 'Aired episodes without a file, plus future ones.' },
  { value: 'existing', title: 'Existing episodes', description: 'Episodes that already have a file, plus future ones.' },
  { value: 'firstSeason', title: 'First season', description: 'Only Season 1.' },
  { value: 'none', title: 'None', description: 'Nothing is monitored. Files stay on disk.' },
];

const option = (scope: typeof scopes[number]) => (
  <OptionRow key={scope.value} control={<Radio value={scope.value} />} title={scope.title} description={scope.description} />
);

const meta = {
  title: 'Overlays & bars/PanelInline',
  component: PanelInline,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-7129' } },
  decorators: [(Story) => <div className="w-220"><Story /></div>],
  args: {
    open: true,
    title: 'Mark this grab as failed?',
    onClose: fn(),
    primary: <Button size="large" onClick={fn()}>Mark as failed, keep seeding</Button>,
    secondary: <Button variant="outline" onClick={fn()}>Cancel</Button>,
    children: (
      <div className="flex flex-col gap-2 px-5">
        <p className="text-body leading-normal text-muted-foreground">
          Sonarr blocklists this release and searches again. Your current file stays until a replacement imports; the torrent keeps seeding in rTorrent.
        </p>
      </div>
    ),
  },
} satisfies Meta<typeof PanelInline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const PrimaryLoading: Story = { args: { primary: <Button size="large" loading>Mark as failed, keep seeding</Button> } };

export const WithHint: Story = {
  args: {
    title: 'Change monitoring',
    primary: <Button size="large" onClick={fn()}>Apply monitoring</Button>,
    hint: 'Monitors 19 episodes across 2 seasons',
    children: (
      <RadioGroup defaultValue="all" aria-label="Monitor" className="flex gap-6 px-5 py-4">
        <div className="flex flex-1 flex-col">{scopes.slice(0, 3).map(option)}</div>
        <div className="flex flex-1 flex-col">{scopes.slice(3).map(option)}</div>
      </RadioGroup>
    ),
  },
};

export const WithoutFooter: Story = {
  args: {
    title: 'Pick a release for Severance S02E01',
    primary: undefined,
    secondary: undefined,
    children: (
      <div className="px-5 pt-3 pb-6">
        <p className="flex items-center gap-2 font-ui text-sm text-muted-foreground">
          <Spinner />
          Reading Severance S02E01 from Sonarr…
        </p>
      </div>
    ),
  },
};
