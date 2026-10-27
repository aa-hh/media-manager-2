import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { CalendarDayHeader, CalendarEntry, CalendarHeader, CalendarMonthCell, CalendarNowLine } from '@/components/ui/calendar';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const meta = {
  title: 'UI/Calendar',
  component: CalendarEntry,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-3904' } },
  // A tile fills its day column; week view columns are this wide.
  render: (args) => <div className="w-47"><CalendarEntry {...args} /></div>,
  args: { href: '/series/12', title: 'Severance', meta: '21:00 · S02E05', onClick: fn() },
} satisfies Meta<typeof CalendarEntry>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {};

export const Missing: Story = { args: { state: 'missing', meta: '21:00 · S02E04 · missing' } };

export const GaveUp: Story = { args: { state: 'gave-up', meta: '21:00 · S02E03 · gave up' } };

export const Downloading: Story = { args: { state: 'downloading', meta: '21:00 · S02E05 · Downloading 42%', progress: 42 } };

export const NotMonitored: Story = { args: { state: 'not-monitored', href: '/series/31', title: 'The Bear', meta: '03:00 · S04E01' } };

export const Compact: Story = { args: { compact: true, title: 'Severance S02E05' } };

export const CompactMissing: Story = { args: { compact: true, state: 'missing', title: 'Severance S02E04' } };

export const DayHeader: Story = { render: () => <CalendarDayHeader day="Wed" date={8} tag="tomorrow" /> };

export const DayHeaderToday: Story = { render: () => <CalendarDayHeader day="Tue" date={7} today tag="today" /> };

export const NowLine: Story = { render: () => <div className="w-47"><CalendarNowLine time="14:32" /></div> };

// Week view: one day column as the calendar screen draws it, with the now line between what aired and what is still to come.
export const WeekColumn: Story = {
  render: (args) => (
    <section aria-label="Tue Oct 07 2025" aria-current="date" className="flex w-47 flex-col gap-2">
      <CalendarDayHeader day="Tue" date={7} today tag="today" />
      <CalendarEntry {...args} state="missing" title="Severance" meta="03:00 · S02E04 · missing" />
      <CalendarNowLine time="14:32" />
      <CalendarEntry {...args} title="Slow Horses" href="/series/27" meta="21:00 · S05E03" />
    </section>
  ),
};

export const MonthCell: Story = {
  render: (args) => (
    <CalendarMonthCell role="group" aria-label="Fri Oct 10 2025" date={10} className="w-40">
      <CalendarEntry {...args} compact title="Severance S02E05" />
      <CalendarEntry {...args} compact href="/movie/8" title="Dune: Part Two" />
    </CalendarMonthCell>
  ),
};

export const MonthCellTodayWithMore: Story = {
  render: (args) => (
    <CalendarMonthCell
      role="group"
      aria-label="Tue Oct 07 2025"
      date={7}
      today
      more={<button type="button" onClick={fn()} className="rounded-xs hover:underline focus-ring">+2 more</button>}
      className="w-40"
    >
      <CalendarEntry {...args} compact state="missing" title="Severance S02E04" />
      <CalendarEntry {...args} compact href="/series/27" title="Slow Horses S05E03" />
    </CalendarMonthCell>
  ),
};

export const MonthCellOutside: Story = { render: () => <CalendarMonthCell role="group" aria-label="Tue Sep 30 2025" date={30} outside className="w-40" /> };

export const Header: Story = {
  render: () => (
    <CalendarHeader
      range="6 – 12 Oct 2025"
      missing="2 missing"
      onPrevious={fn()}
      onToday={fn()}
      onNext={fn()}
      previousLabel="Previous"
      nextLabel="Next"
      timeZone="Times in Europe/London"
      view={(
        <ToggleGroup aria-label="Calendar view" value="week" onValueChange={fn()}>
          <ToggleGroupItem value="week">Week</ToggleGroupItem>
          <ToggleGroupItem value="month">Month</ToggleGroupItem>
          <ToggleGroupItem value="forecast">Forecast</ToggleGroupItem>
        </ToggleGroup>
      )}
      className="w-300"
    />
  ),
};

export const HeaderNothingMissing: Story = {
  render: () => (
    <CalendarHeader range="October 2025" onPrevious={fn()} onToday={fn()} onNext={fn()} previousLabel="Previous" nextLabel="Next" timeZone="Times in Europe/London" className="w-300" />
  ),
};
