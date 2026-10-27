import type { Meta, StoryObj } from '@storybook/react-vite';
import { List, Search } from 'lucide-react';
import { expect, fn, waitFor, within } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

const meta = {
  title: 'Actions & inputs/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-3507' } },
  // Room on every side for the tooltip.
  decorators: [
    (Story) => (
      <div className="flex h-48 items-center justify-center p-16">
        <Story />
      </div>
    ),
  ],
  args: {
    text: 'Pick a release',
    children: <Button variant="ghost" size="row" iconOnly icon={<List className="text-muted-foreground" />} aria-label="Pick a release" onClick={fn()} />,
  },
  // The tooltip has no open prop; hover the trigger and wait out the delay so the story shows it.
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.hover(canvas.getByRole('button'));
    await within(document.body).findByText(String(args.text));
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Top: Story = {};

export const Bottom: Story = { args: { side: 'bottom' } };

export const Left: Story = { args: { side: 'left' } };

export const Right: Story = { args: { side: 'right' } };

export const WithKbd: Story = {
  args: {
    text: 'Search',
    kbd: '/',
    children: <Button variant="ghost" iconOnly icon={<Search />} aria-label="Search" onClick={fn()} />,
  },
};

export const LongText: Story = {
  args: {
    text: 'Severance.S02E01.Hello.Ms.Cobel.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX',
    children: <span className="max-w-40 truncate font-data text-sm text-foreground" tabIndex={0}>Severance.S02E01.Hello.Ms.Cobel.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX</span>,
  },
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.hover(canvas.getByText(String(args.text)));
    // The trigger shows the same text, so wait for a second copy.
    await waitFor(() => expect(within(document.body).getAllByText(String(args.text))).toHaveLength(2));
  },
};
