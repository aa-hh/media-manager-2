// v2/Toast — design/design-system.lib.pen Dslj1
import { Toast } from '@base-ui/react/toast';
import { Check, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';

// --duration-toast in globals.css; base-ui takes the timeout as a number, so keep the two equal.
const toastTimeout = 6000;

/** Extra fields a screen may pass in the toast's `data`. */
type ToastData = {
  /** Key hint after the action label; show only where the shortcut exists. */
  actionKbd?: ReactNode;
};

/**
 * Wraps the app so screens can call useToastManager().add({ title, description, type: 'error', actionProps, data }).
 * Toasts default to duration-toast (a screen may pass its own timeout), pause while hovered, and sit bottom left above the downloads bar.
 */
function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider timeout={toastTimeout}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed bottom-[calc(var(--livebar)+var(--space-10))] left-(--page-margin) z-50 flex flex-col gap-2 outline-hidden">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager<ToastData>();
  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      className={cn(
        'flex w-100 items-center gap-3 rounded-lg bg-bar py-3 pr-3 pl-3.5 text-bar-foreground',
        'shadow-[0_2px_6px_color-mix(in_srgb,var(--foreground)_6%,transparent),0_8px_24px_var(--shadow)]',
        // In: slide up 12 px and fade, duration-slow ease-out. Out: fade, duration-fast ease-in.
        'transition-[opacity,translate] duration-(--duration-slow) ease-out',
        'data-starting-style:translate-y-(--motion-rise-12) data-starting-style:opacity-0',
        'data-ending-style:opacity-0 data-ending-style:duration-(--duration-fast) data-ending-style:ease-in',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('flex size-5.5 shrink-0 items-center justify-center rounded-full [&>svg]:size-4', toast.type === 'error' && 'bg-destructive')}
      >
        {toast.type === 'error' ? <X /> : <Check />}
      </span>
      <Toast.Content className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Toast.Title className="font-ui text-sm font-semibold text-bar-foreground" />
        <Toast.Description className="font-ui text-[13px] font-normal text-bar-muted-foreground" />
      </Toast.Content>
      {toast.actionProps !== undefined && (
        <Toast.Action
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-sm px-1.5 py-1 font-ui text-sm font-semibold text-bar-foreground',
            'transition-colors duration-(--duration-fast) ease-out active:duration-0 focus-ring-on-dark',
            'hover:bg-bar-foreground/12 hover:underline',
          )}
        >
          {toast.actionProps.children}
          {toast.data?.actionKbd !== undefined && <Kbd onFill>{toast.data.actionKbd}</Kbd>}
        </Toast.Action>
      )}
      <Toast.Close aria-label="Close" className="inline-flex shrink-0 rounded-xs text-bar-muted-foreground focus-ring-on-dark">
        <X aria-hidden="true" className="size-4" />
      </Toast.Close>
    </Toast.Root>
  ));
}

const useToastManager = Toast.useToastManager<ToastData>;

export { ToastProvider, useToastManager };
export type { ToastData };
