import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Same props and classes as ActionButton in downloads/Downloads.tsx, for the other screens.
export function ScreenButton({ children, onClick, disabled, filled }: { children: ReactNode; onClick: () => void; disabled?: boolean; filled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => { event.stopPropagation(); onClick(); }}
      className={cn(
        'h-8 shrink-0 px-3 font-ui text-[14px] font-semibold disabled:opacity-50',
        'focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-[var(--mm-ink)]',
        filled ? 'bg-[var(--mm-ink)] text-[var(--mm-on-cell)]' : 'border border-[var(--mm-ink-3)] text-[var(--mm-ink)] hover:bg-[var(--mm-row-hover)]',
      )}
    >
      {children}
    </button>
  );
}

export function ScreenHeading({ title, summary, children }: { title: string; summary?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 pb-3 pt-5">
      <h1 className="font-ui text-[22px] font-semibold text-[var(--mm-ink)]">{title}</h1>
      {summary !== undefined && <p className="text-[13px] text-[var(--mm-ink-2)]">{summary}</p>}
      <span className="flex-1" />
      {children}
    </div>
  );
}
