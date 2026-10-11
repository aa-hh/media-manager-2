// v2/Calendar/Entry — design/design-system.lib.pen zrJc8
// v2/Calendar/DayHeader — design/design-system.lib.pen t2YxG
// v2/Calendar/MonthCell — design/design-system.lib.pen z4pNq0
// v2/Calendar/Now line — design/design-system.lib.pen Ey0Ju
// v2/Calendar/Header — design/design-system.lib.pen kGPpG
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type EntryState = 'normal' | 'missing' | 'gave-up' | 'downloading' | 'not-monitored';

type CalendarEntryProps = ComponentProps<'a'> & {
  state?: EntryState;
  title: ReactNode;
  meta?: ReactNode;
  /** Downloading percent: the black bar under the meta line. */
  progress?: number;
  /** Month view: tighter padding, no meta line. */
  compact?: boolean;
};

/** One episode or movie: a grey tile that opens the title. Missing gets an amber bar, gave up a red one. */
function CalendarEntry({ state = 'normal', title, meta, progress, compact = false, className, ...props }: CalendarEntryProps) {
  const faded = state === 'not-monitored' && 'text-subtle-foreground';
  return (
    <a
      className={cn(
        'relative flex w-full flex-col gap-0.5 overflow-hidden rounded-sm bg-muted',
        compact ? 'py-0.75 pr-1.5 pl-2' : 'py-1.5 pr-2 pl-2.5',
        'transition-colors duration-(--duration-fast) ease-out hover:bg-surface-pressed',
        'active:bg-[color-mix(in_srgb,var(--surface-pressed),var(--foreground)_5%)] active:duration-0 focus-ring',
        className,
      )}
      {...props}
    >
      {(state === 'missing' || state === 'gave-up') && (
        <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-0.75', state === 'missing' ? 'bg-warning' : 'bg-destructive')} />
      )}
      <span className={cn('truncate font-ui text-[13px] font-semibold text-foreground', faded)}>{title}</span>
      {!compact && meta !== undefined && (
        <span
          className={cn(
            'truncate font-data text-xs text-muted-foreground',
            state === 'missing' && 'text-warning',
            state === 'gave-up' && 'text-destructive',
            faded,
          )}
        >
          {meta}
        </span>
      )}
      {!compact && progress !== undefined && <Progress value={progress} className="[&>div]:bg-foreground/8" />}
    </a>
  );
}

const dateCircle = (today: boolean) =>
  cn('flex size-6 shrink-0 items-center justify-center rounded-full font-data text-[13px] font-semibold', today ? 'bg-foreground text-primary-foreground' : 'text-foreground');

type CalendarDayHeaderProps = ComponentProps<'div'> & {
  /** Short day name; shown in capitals. */
  day: ReactNode;
  date: ReactNode;
  today?: boolean;
  /** "today" or "tomorrow". */
  tag?: ReactNode;
};

/** Column head in week view, 32 px. Today's date sits in a black circle. */
function CalendarDayHeader({ day, date, today = false, tag, className, ...props }: CalendarDayHeaderProps) {
  return (
    <div className={cn('flex h-8 items-center gap-1.5', className)} {...props}>
      <span className="font-ui text-[11px] font-semibold tracking-[0.6px] text-subtle-foreground uppercase">{day}</span>
      <span className={dateCircle(today)}>{date}</span>
      {tag !== undefined && <span className={cn('font-ui text-xs', today ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground')}>{tag}</span>}
    </div>
  );
}

type CalendarMonthCellProps = ComponentProps<'div'> & {
  date: ReactNode;
  today?: boolean;
  /** Outside the shown month: grey fill, faint date. */
  outside?: boolean;
  /** Such as "+2 more"; pass a link to make it open the day. */
  more?: ReactNode;
};

/** One day in month view, 132 px tall hairline cell. Children are up to three compact CalendarEntry tiles. */
function CalendarMonthCell({ date, today = false, outside = false, more, className, children, ...props }: CalendarMonthCellProps) {
  return (
    <div className={cn('flex h-33 flex-col gap-1 overflow-hidden border border-border p-1.5', outside ? 'bg-surface-hover' : 'bg-card', className)} {...props}>
      <span className={cn(dateCircle(today), outside && 'text-faint-foreground')}>{date}</span>
      {children !== undefined && <div className="flex w-full flex-col gap-0.75">{children}</div>}
      {more !== undefined && <span className="font-ui text-xs font-semibold text-muted-foreground">{more}</span>}
    </div>
  );
}

/** The current time across today's column in week view: 8 px dot, 2 px black line, the time. Position it with top. */
function CalendarNowLine({ time, className, ...props }: ComponentProps<'div'> & { time: ReactNode }) {
  return (
    <div className={cn('flex h-4 w-full items-center gap-1', className)} {...props}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-foreground" />
      <span aria-hidden="true" className="h-0.5 min-w-0 flex-1 bg-foreground" />
      <span className="font-data text-xs font-semibold text-foreground">{time}</span>
    </div>
  );
}

type CalendarHeaderProps = ComponentProps<'div'> & {
  /** Such as "6 to 12 Oct". */
  range: ReactNode;
  /** Such as "2 missing"; off when none. */
  missing?: ReactNode;
  onPrevious: () => void;
  onToday: () => void;
  onNext: () => void;
  previousLabel: string;
  nextLabel: string;
  todayLabel?: ReactNode;
  /** Key hint on Today; the calendar binds T. */
  todayKbd?: ReactNode;
  timeZone?: ReactNode;
  /** The view ToggleGroup. */
  view?: ReactNode;
};

/** Above the calendar, 56 px: range, missing badge, previous / today / next, time zone and the view switch. */
function CalendarHeader({ range, missing, onPrevious, onToday, onNext, previousLabel, nextLabel, todayLabel = 'Today', todayKbd = 'T', timeZone, view, className, ...props }: CalendarHeaderProps) {
  return (
    <div className={cn('flex h-14 w-full items-center gap-3', className)} {...props}>
      <h2 className="m-0 font-ui text-xl font-bold text-foreground">{range}</h2>
      {missing !== undefined && <Badge variant="warning">{missing}</Badge>}
      <div className="flex items-center gap-1">
        <Button variant="outline" iconOnly icon={<ChevronLeft aria-hidden="true" />} aria-label={previousLabel} onClick={onPrevious} />
        <Button variant="outline" kbd={todayKbd} onClick={onToday}>{todayLabel}</Button>
        <Button variant="outline" iconOnly icon={<ChevronRight aria-hidden="true" />} aria-label={nextLabel} onClick={onNext} />
      </div>
      <span className="flex-1" />
      {timeZone !== undefined && <span className="font-ui text-[13px] text-subtle-foreground">{timeZone}</span>}
      {view}
    </div>
  );
}

export { CalendarDayHeader, CalendarEntry, CalendarHeader, CalendarMonthCell, CalendarNowLine };
export type { EntryState };
