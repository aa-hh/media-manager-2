import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { SectionLabel } from '@/components/ui/section-label';

const meta = {
  title: 'Headers & navigation/SectionLabel',
  component: SectionLabel,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/dFQMjELOx6ObLS0qOG3NCF?node-id=38-544' } },
  args: { label: 'TV', place: 'Library', href: '/', onClick: fn() },
} satisfies Meta<typeof SectionLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InLibrary: Story = {};

export const Movies: Story = { args: { label: 'Movies' } };

export const NotInLibrary: Story = { args: { label: 'Movies', place: 'Discover', href: '/discover' } };

export const FromSearch: Story = { args: { label: 'Search', place: '“severance”', href: '/search?q=severance' } };
