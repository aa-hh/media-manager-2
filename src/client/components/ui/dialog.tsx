// v2/Dialog — design/design-system.lib.pen Oi69B
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Scrim } from '@/components/ui/scrim';
import { cn } from '@/lib/utils';

type DialogProps = {
  open: boolean;
  /** Called with false on Esc, a scrim click or Close. */
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** What the action touches, such as "S02E04 · 720p · 1.4 GB". */
  subject?: ReactNode;
  /** Card/choice options inside a RadioGroup. */
  children?: ReactNode;
  /** A Callout under the options. */
  callout?: ReactNode;
  /** Right-aligned buttons: an outline Cancel, then the large main action. */
  actions: ReactNode;
  closeLabel?: string;
};

/**
 * Centred confirmation over the scrim for rare, destructive or lossy actions.
 * Scrim and dialog fade in and the dialog scales from --motion-scale-dialog to 1 (duration-base, ease-out); the reverse at duration-fast, ease-in.
 */
function Dialog({ open, onOpenChange, title, subject, children, callout, actions, closeLabel = 'Close' }: DialogProps) {
  const motion = 'duration-(--duration-base) ease-out data-ending-style:duration-(--duration-fast) data-ending-style:ease-in';
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          render={<Scrim />}
          className={cn('transition-opacity data-starting-style:opacity-0 data-ending-style:opacity-0', motion)}
        />
        <DialogPrimitive.Popup
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-5rem)] w-140 -translate-1/2 flex-col rounded-lg border border-border bg-card p-6 outline-hidden',
            'shadow-[0_2px_6px_color-mix(in_srgb,var(--foreground)_6%,transparent),0_8px_24px_var(--shadow)]',
            'transition-[opacity,scale]',
            'data-starting-style:scale-(--motion-scale-dialog) data-starting-style:opacity-0',
            'data-ending-style:scale-(--motion-scale-dialog) data-ending-style:opacity-0',
            motion,
          )}
        >
          <div className="flex w-full items-start gap-4">
            <DialogPrimitive.Title className="min-w-0 flex-1 font-ui text-lg font-bold text-foreground">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close
              render={<Button variant="ghost" icon={<X />} kbd="Esc" aria-label={closeLabel} className="px-2.5 [&>svg]:text-muted-foreground" />}
            />
          </div>
          <div className="min-h-0 w-full flex-1 overflow-y-auto">
            {subject !== undefined && (
              <DialogPrimitive.Description className="pt-2 font-ui text-sm leading-normal font-normal text-muted-foreground">{subject}</DialogPrimitive.Description>
            )}
            {children !== undefined && <div className="flex w-full flex-col gap-2 pt-5">{children}</div>}
            {callout !== undefined && <div className="w-full pt-3">{callout}</div>}
          </div>
          <div className="flex w-full items-center justify-end gap-2 pt-6">{actions}</div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export { Dialog };
