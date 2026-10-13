import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { InputSearch } from '@/components/ui/input-search';
import { cn } from '@/lib/utils';

type ServicesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: Array<{ id: number; name: string }>;
  selected: number[];
  onSave: (ids: number[]) => void;
};

/** Picks the streaming services that get a row each. The choice is a draft until Save. */
export function ServicesDialog({ open, onOpenChange, providers, selected, onSave }: ServicesDialogProps) {
  const [draft, setDraft] = useState(selected);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setDraft(selected);
    setQuery('');
  }, [open, selected]);

  const shown = providers.filter((provider) => provider.name.toLowerCase().includes(query.trim().toLowerCase()));
  const toggle = (id: number, checked: boolean) => setDraft((current) => (checked ? [...current, id] : current.filter((other) => other !== id)));

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Streaming services"
      subject="Pick the services you want a Discover row for. Availability comes from JustWatch for the United States."
      actions={(
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(draft)}>Save</Button>
        </>
      )}
    >
      <InputSearch variant="field" placeholder="Search services" aria-label="Search services" value={query} onValueChange={(value) => setQuery(String(value))} onClear={() => setQuery('')} />
      <ul aria-label="Streaming services" className="flex flex-col gap-0.5">
        {shown.map((provider) => {
          const checked = draft.includes(provider.id);
          return (
            <li key={provider.id}>
              <label className={cn('flex h-9 items-center gap-2.5 rounded-xs px-2 font-ui text-sm text-foreground', checked ? 'bg-muted font-semibold' : 'hover:bg-surface-hover')}>
                <Checkbox checked={checked} onCheckedChange={(next) => toggle(provider.id, next)} />
                {provider.name}
              </label>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && query.trim() !== '' && (
        <p role="status" className="px-2 font-ui text-sm text-muted-foreground [overflow-wrap:anywhere]">No services match “{query.trim()}”.</p>
      )}
      <div className="flex items-center gap-2">
        <span className="flex-1 font-ui text-[13px] text-muted-foreground">
          {draft.length} selected · adds {draft.length} {draft.length === 1 ? 'row' : 'rows'}
        </span>
        <Button variant="ghost" size="row" onClick={() => setDraft([])}>Clear</Button>
      </div>
    </Dialog>
  );
}
