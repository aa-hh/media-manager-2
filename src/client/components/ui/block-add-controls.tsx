// v2/Block/add-controls — ~/Projects/media-manager-2-design/design-system.lib.pen RJNba
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type BlockAddControlsProps = {
  /** Small capital heading, such as "Add to Sonarr". */
  heading: ReactNode;
  /** Label over the monitor controls, such as "Monitor". */
  monitorLabel?: ReactNode;
  /** A ToggleGroup of the first choices, then a menu Button ("More") for the rest. */
  monitor?: ReactNode;
  /** Select triggers: quality profile, and minimum availability for movies. */
  selects?: ReactNode;
  /** An OptionRow with a Checkbox: Search on add. Its side padding is removed here. */
  option?: ReactNode;
  /** A Callout above the footer: Sonarr refused the add, or, alone, the add options could not load. */
  callout?: ReactNode;
  /** Large default Button. */
  primary?: ReactNode;
  /** Outline Button. */
  secondary?: ReactNode;
  /** Right-aligned data line saying what adding will do. */
  preview?: ReactNode;
  className?: string;
};

/** The add decision on a title not yet in the library. In the page flow: line edge, radius 8, no shadow. */
function BlockAddControls({ heading, monitorLabel, monitor, selects, option, callout, primary, secondary, preview, className }: BlockAddControlsProps) {
  return (
    <section className={cn('flex w-170 flex-col gap-4 rounded-md border border-border bg-card p-5', className)}>
      <h2 className="font-ui text-[11px] font-semibold tracking-[0.6px] text-subtle-foreground uppercase">{heading}</h2>
      {monitor !== undefined && (
        <div className="flex w-full flex-col gap-1.5">
          <p className="font-ui text-[13px] font-semibold text-foreground">{monitorLabel}</p>
          <div className="flex items-center gap-2">{monitor}</div>
        </div>
      )}
      {selects !== undefined && <div className="flex w-full gap-3">{selects}</div>}
      {option !== undefined && <div className="w-full [&>label]:px-0 [&>label]:py-1.5">{option}</div>}
      {callout}
      {(primary !== undefined || secondary !== undefined || preview !== undefined) && (
        <div className="flex w-full items-center gap-2">
          {primary}
          {secondary}
          {preview !== undefined && <p className="min-w-0 flex-1 text-right font-data text-sm font-normal text-muted-foreground">{preview}</p>}
        </div>
      )}
    </section>
  );
}

export { BlockAddControls };
