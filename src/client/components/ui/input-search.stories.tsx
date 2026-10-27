import type { Meta, StoryObj } from '@storybook/react-vite';
import { Lock } from 'lucide-react';
import { fn } from 'storybook/test';
import { InputSearch } from '@/components/ui/input-search';

const meta = {
  title: 'UI/InputSearch',
  component: InputSearch,
  tags: ['autodocs'],
  // The search field fills the app bar's middle column; the form fields fill a settings column.
  decorators: [(Story) => <div className="w-130"><Story /></div>],
  args: {
    type: 'search',
    autoComplete: 'off',
    spellCheck: false,
    'aria-label': 'Search library, Sonarr and Radarr',
    placeholder: 'Search movies and TV shows',
    onValueChange: fn(),
  },
} satisfies Meta<typeof InputSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Search: Story = { args: { kbd: '/', onClear: fn() } };

export const SearchWithText: Story = { args: { kbd: '/', value: 'severance', onClear: fn() } };

export const Field: Story = {
  args: {
    variant: 'field',
    type: 'url',
    'aria-label': 'Address',
    placeholder: 'e.g. http://localhost:8989',
    defaultValue: 'http://localhost:8989',
  },
};

export const FieldEmpty: Story = { args: { variant: 'field', type: 'url', 'aria-label': 'Address', placeholder: 'e.g. http://localhost:8989' } };

export const FieldInvalid: Story = {
  args: { variant: 'field', type: 'url', 'aria-label': 'Address', defaultValue: 'http://localhost:8988', 'aria-invalid': true },
};

export const FieldLocked: Story = {
  args: {
    variant: 'field',
    type: undefined,
    'aria-label': 'API key',
    readOnly: true,
    value: '',
    icon: <Lock aria-hidden="true" />,
    placeholder: '••••••••••••••••••••',
    wrapperClassName: 'bg-muted',
  },
};

export const FieldDisabled: Story = {
  args: { variant: 'field', type: undefined, inputMode: 'decimal', className: 'font-data', 'aria-label': 'Global ratio minimum', defaultValue: '0.60', disabled: true },
};

export const FieldOnDark: Story = {
  // The on-dark look belongs to the sign-in page's near-black ground.
  decorators: [(Story) => <div className="bg-[#07080b] p-6"><Story /></div>],
  args: { variant: 'field-on-dark', type: 'url', 'aria-label': 'Jellyfin server address', placeholder: 'http://192.168.1.20:8096' },
};

export const FieldOnDarkInvalid: Story = {
  decorators: [(Story) => <div className="bg-[#07080b] p-6"><Story /></div>],
  args: { variant: 'field-on-dark', type: 'url', 'aria-label': 'Jellyfin server address', defaultValue: 'http://192.168.1.20:8095', 'aria-invalid': true },
};

export const Disabled: Story = { args: { disabled: true } };
