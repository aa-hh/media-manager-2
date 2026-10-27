import type { Meta, StoryObj } from '@storybook/react-vite';
import { FactStacked } from '@/components/ui/fact-stacked';

const meta = {
  title: 'UI/FactStacked',
  component: FactStacked,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-1256' } },
  // The title page puts each row of three facts in a <dl> grid.
  decorators: [(Story) => <dl className="m-0 grid w-180 grid-cols-3 gap-6"><Story /></dl>],
  args: { label: 'Studio', children: 'Legendary Pictures', className: '[overflow-wrap:anywhere]' },
} satisfies Meta<typeof FactStacked>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Row: Story = {
  render: () => (
    <>
      <FactStacked label="Status" className="[overflow-wrap:anywhere]">Released</FactStacked>
      <FactStacked label="In cinemas" className="[overflow-wrap:anywhere]">1 Mar 2024</FactStacked>
      <FactStacked label="Digital" className="[overflow-wrap:anywhere]">16 Apr 2024</FactStacked>
    </>
  ),
};

export const LongValue: Story = {
  args: { label: 'Producers', children: 'Mary Parent, Cale Boyter, Patrick McCormick, Tanya Lapointe, Denis Villeneuve' },
};
