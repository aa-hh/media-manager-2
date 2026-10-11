// v2/Panel/inline — design/design-system.lib.pen cZb0Z
import { Collapsible } from '@base-ui/react/collapsible';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PanelInlineProps = {
  open: boolean;
  title: ReactNode;
  /** The ghost Close button with the Esc hint; the screen binds Esc itself. */
  onClose: () => void;
  closeLabel?: string;
  /** Full-bleed content: option rows, a release table, choice cards. */
  children: ReactNode;
  /** The one 48 px main action (large default Button). */
  primary?: ReactNode;
  /** Outline Button, such as Cancel. */
  secondary?: ReactNode;
  /** Right-aligned line explaining what the main action does. */
  hint?: ReactNode;
  className?: string;
};

/**
 * Opens in place under a row or in the title header. In the page flow: line edge, no shadow, radius 10.
 * Open: height 0 to full (duration-size), fade and a 6 px rise (duration-base, ease-out). Close: the reverse at duration-fast, ease-in.
 * Under reduced motion the height change is instant and only the fade remains.
 */
function PanelInline({ open, title, onClose, closeLabel = 'Close', children, primary, secondary, hint, className }: PanelInlineProps) {
  const footer = primary !== undefined || secondary !== undefined || hint !== undefined;
  return (
    <Collapsible.Root open={open}>
      <Collapsible.Panel
        className={cn(
          'group/panel h-(--collapsible-panel-height) overflow-hidden',
          'transition-[height] duration-(--duration-size) ease-out data-ending-style:duration-(--duration-fast) data-ending-style:ease-in',
          'data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none',
        )}
      >
        <section
          aria-label={typeof title === 'string' ? title : undefined}
          className={cn(
            'flex w-full flex-col gap-4 overflow-hidden rounded-lg border border-border bg-card pt-5',
            'transition-[opacity,translate] duration-(--duration-base) ease-out',
            'group-data-starting-style/panel:translate-y-(--motion-rise-6) group-data-starting-style/panel:opacity-0',
            'group-data-ending-style/panel:translate-y-(--motion-rise-6) group-data-ending-style/panel:opacity-0',
            'group-data-ending-style/panel:duration-(--duration-fast) group-data-ending-style/panel:ease-in',
            !footer && 'pb-5',
            className,
          )}
        >
          <header className="flex w-full items-center gap-2 px-5">
            <h2 className="min-w-0 flex-1 font-ui text-lg font-bold text-foreground">{title}</h2>
            <Button variant="ghost" icon={<X />} kbd="Esc" aria-label={closeLabel} onClick={onClose} className="px-2.5 [&>svg]:text-muted-foreground" />
          </header>
          <div className="w-full">{children}</div>
          {footer && (
            <footer className="flex w-full items-center gap-2 px-5 pb-5">
              {primary}
              {secondary}
              {hint !== undefined && <p className="min-w-0 flex-1 text-right font-ui text-xs font-normal text-subtle-foreground">{hint}</p>}
            </footer>
          )}
        </section>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

export { PanelInline };
