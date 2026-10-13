import { Popover } from '@base-ui/react/popover';
import { ChevronDown, Clapperboard, LayoutGrid, Tv } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ChipFilter } from '@/components/ui/chip-filter';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  floatingSurface,
  SelectContent,
  SelectItem,
} from '@/components/ui/dropdown-menu';
import { FieldNumber } from '@/components/ui/field-number';
import { Select, SelectTrigger } from '@/components/ui/select-trigger';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { filterTags, hiddenRowsNote, type Filters, type MediaType, type Sort } from './model';

type Option = { id: number; name: string };
type BarState = Filters & { type: MediaType; sort?: Sort };

type FilterBarProps<S extends BarState> = {
  state: S;
  onChange: (next: S) => void;
  genres: Option[];
  providers: Option[];
  /** The media type toggle inside the bar (the home); grids put theirs in the page header. */
  type?: { value: MediaType; options: MediaType[] };
  sort?: boolean;
  /** The home: the service menu reads "Available on" and the hidden-rows note shows. */
  window?: boolean;
  /** The trending grid: Genres and Services only, then the ranking note. */
  trending?: boolean;
};

const typeItems: Record<MediaType, { label: string; icon: ReactNode }> = {
  all: { label: 'All', icon: <LayoutGrid aria-hidden="true" /> },
  movie: { label: 'Movies', icon: <Clapperboard aria-hidden="true" /> },
  tv: { label: 'TV', icon: <Tv aria-hidden="true" /> },
};

const ratings: Array<[string, string]> = [['any', 'Any'], ['6', '6 and above'], ['7', '7 and above'], ['8', '8 and above']];
const sortLabels: Array<[Sort, string]> = [['popular', 'Popularity'], ['rating', 'Rating'], ['newest', 'Newest'], ['upcoming', 'Upcoming']];

// Menus and the Years popover are not Selects, so they copy the Select trigger's look (lead, value, chevron).
const triggerLook = (active: boolean) => cn(
  'group inline-flex h-(--control-h-default) max-w-80 shrink-0 items-center gap-1.5 rounded-(--control-radius-default) border border-input bg-card pr-3 pl-(--control-px-default)',
  'font-ui text-(length:--control-text-default) text-foreground [&_svg]:size-(--control-icon-default)',
  'transition-colors duration-(--duration-fast) ease-out active:duration-0 focus-ring',
  'hover:border-muted-foreground hover:bg-surface-hover data-popup-open:border-muted-foreground data-popup-open:bg-surface-pressed',
  active && 'border-foreground',
);

function TriggerBody({ lead, value }: { lead: string; value: string }) {
  return (
    <>
      <span className="font-normal text-subtle-foreground">{lead}</span>
      <span className="min-w-0 truncate font-semibold">{value}</span>
      <ChevronDown aria-hidden="true" className="shrink-0 text-muted-foreground group-data-popup-open:rotate-180" />
    </>
  );
}

const names = (ids: number[], options: Option[]) => {
  const known = ids.flatMap((id) => options.find((option) => option.id === id)?.name ?? []);
  return known.length === 0 ? (ids.length === 0 ? 'Any' : `${ids.length} selected`) : known.join(', ');
};

function MenuFooter({ count, onClear }: { count: number; onClear: () => void }) {
  return (
    <div className="mt-1 flex items-center gap-2 border-t border-border pt-1.5 pr-1 pb-1 pl-2">
      <span className="flex-1 font-ui text-[13px] text-muted-foreground">{count} selected</span>
      <Button variant="ghost" size="row" onClick={onClear}>Clear</Button>
    </div>
  );
}

function ChecklistMenu({ lead, options, selected, onChange }: { lead: string; options: Option[]; selected: number[]; onChange: (ids: number[]) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerLook(selected.length > 0)}>
        <TriggerBody lead={lead} value={names(selected, options)} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-70">
        <div className="max-h-96 overflow-y-auto">
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.id}
              closeOnClick={false}
              checked={selected.includes(option.id)}
              onCheckedChange={(checked) => onChange(checked ? [...selected, option.id] : selected.filter((id) => id !== option.id))}
            >
              {option.name}
            </DropdownMenuCheckboxItem>
          ))}
        </div>
        <MenuFooter count={selected.length} onClear={() => onChange([])} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const yearText = (from: number | null, to: number | null) => {
  if (from !== null && to !== null) return `${from}–${to}`;
  if (from !== null) return `From ${from}`;
  if (to !== null) return `Up to ${to}`;
  return 'Any';
};

function YearsPopover({ from, to, onChange }: { from: number | null; to: number | null; onChange: (from: number | null, to: number | null) => void }) {
  const [draft, setDraft] = useState({ from: '', to: '' });
  // A year is applied once it has four digits (or is emptied) and the range still runs forwards.
  const edit = (field: 'from' | 'to', text: string) => {
    const next = { ...draft, [field]: text };
    setDraft(next);
    const parse = (value: string) => (value === '' ? null : /^\d{4}$/.test(value) ? Number(value) : undefined);
    const nextFrom = parse(next.from);
    const nextTo = parse(next.to);
    if (nextFrom === undefined || nextTo === undefined) return;
    if (nextFrom !== null && nextTo !== null && nextFrom > nextTo) return;
    onChange(nextFrom, nextTo);
  };
  return (
    <Popover.Root onOpenChange={(open) => { if (open) setDraft({ from: from === null ? '' : String(from), to: to === null ? '' : String(to) }); }}>
      <Popover.Trigger className={triggerLook(from !== null || to !== null)}>
        <TriggerBody lead="Years" value={yearText(from, to)} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={4} className="z-50 outline-hidden">
          <Popover.Popup className={cn(floatingSurface, 'w-65')}>
            <div className="flex items-center gap-2 p-2">
              <FieldNumber before="From" inputMode="numeric" value={draft.from} onValueChange={(value) => edit('from', String(value))} />
              <FieldNumber before="To" inputMode="numeric" value={draft.to} onValueChange={(value) => edit('to', String(value))} />
            </div>
            <div className="mt-1 flex items-center justify-end border-t border-border pt-1.5 pr-1 pb-1">
              <Button variant="ghost" size="row" onClick={() => { setDraft({ from: '', to: '' }); onChange(null, null); }}>Clear</Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The Discover filters: sticky under the app bar, with a row of removable tags below once any filter is set. */
export function FilterBar<S extends BarState>({ state, onChange, genres, providers, type, sort = false, window: home = false, trending = false }: FilterBarProps<S>) {
  const tags = filterTags(state, genres, providers);
  const note = home ? hiddenRowsNote(state.type) : undefined;
  const cleared: Filters = { genres: [], providers: [], yearFrom: null, yearTo: null, minRating: null };
  const rating = state.minRating === null ? 'any' : String(state.minRating);
  return (
    <>
      <div className="sticky top-16 z-[5] flex flex-wrap items-center gap-2 border-b border-border bg-background pt-2 pb-5">
        {type !== undefined && (
          <>
            <ToggleGroup aria-label="Media type" value={type.value} onValueChange={(value) => onChange({ ...state, type: value as MediaType })}>
              {type.options.map((option) => (
                <ToggleGroupItem key={option} value={option} icon={typeItems[option].icon} className="px-4 text-sm">
                  {typeItems[option].label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <span aria-hidden="true" className="h-6 w-px shrink-0 bg-border" />
          </>
        )}
        <ChecklistMenu lead="Genres" options={genres} selected={state.genres} onChange={(ids) => onChange({ ...state, genres: ids })} />
        <ChecklistMenu lead={home ? 'Available on' : 'Services'} options={providers} selected={state.providers} onChange={(ids) => onChange({ ...state, providers: ids })} />
        {!trending && (
          <>
            <YearsPopover from={state.yearFrom} to={state.yearTo} onChange={(yearFrom, yearTo) => onChange({ ...state, yearFrom, yearTo })} />
            <Select value={rating} onValueChange={(value) => onChange({ ...state, minRating: value === 'any' || value === null ? null : Number(value) })}>
              <SelectTrigger lead="Rating" className={cn(state.minRating !== null && 'border-foreground')}>
                {ratings.find(([value]) => value === rating)?.[1] ?? `${state.minRating} and above`}
              </SelectTrigger>
              <SelectContent>
                {ratings.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        )}
        {sort && (
          <Select value={state.sort ?? 'popular'} onValueChange={(value) => onChange({ ...state, sort: (value ?? 'popular') as Sort })}>
            <SelectTrigger lead="Sort" className="ml-auto">
              {sortLabels.find(([value]) => value === (state.sort ?? 'popular'))?.[1]}
            </SelectTrigger>
            <SelectContent align="end">
              {sortLabels.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {trending && <span className="ml-auto font-ui text-[13px] text-muted-foreground">Ranked by this week's activity</span>}
      </div>
      {(tags.length > 0 || note !== undefined) && (
        <div className="flex flex-wrap items-center gap-2 pt-3">
          {tags.map((tag) => (
            <ChipFilter key={tag.label} onRemove={() => onChange({ ...state, ...tag.remove })} removeLabel={`Remove ${tag.label}`}>
              {tag.label}
            </ChipFilter>
          ))}
          {tags.length > 0 && <Button variant="ghost" size="row" onClick={() => onChange({ ...state, ...cleared })}>Clear filters</Button>}
          {note !== undefined && <span className="font-ui text-[13px] text-muted-foreground">{note}</span>}
        </div>
      )}
    </>
  );
}
