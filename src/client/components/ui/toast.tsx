// v2/Toast — ~/Projects/media-manager-2-design/design-system.lib.pen Dslj1
import { Toast } from '@base-ui/react/toast';
import { Check, X } from 'lucide-react';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';

// --duration-toast in globals.css; base-ui takes the timeout as a number, so keep the two equal.
const toastTimeout = 6000;

/** Extra fields a screen may pass in the toast's `data`. */
type ToastData = {
  /** Key hint after the action label; show only where the shortcut exists. */
  actionKbd?: ReactNode;
};

// ToastNumber (below ToastList) is the add dialog's number handoff from its closing sentence into the toast's second line.
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
        'flex w-100 max-w-[calc(100vw-2*var(--page-margin))] items-center gap-3 rounded-lg bg-bar py-3 pr-3 pl-3.5 text-bar-foreground',
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
            'inline-flex shrink-0 items-center gap-1.5 rounded-xs px-1.5 py-1 font-ui text-sm font-semibold text-bar-foreground',
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

/**
 * A number in a toast's description that travels in from where it last sat on screen (`from`, a measured rect), turning
 * from an inline-control pill into bar text. Without `from`, or with reduced motion, it simply appears in place.
 */
function ToastNumber({ from, children }: { from: { left: number; top: number; width: number; height: number } | undefined; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null || from === undefined || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // The toast's own 12 px rise is in flight while this measures, so the travel can be off by up to 12 px vertically; accepted.
    const to = element.getBoundingClientRect();
    const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    element.animate([
      {
        transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.height / to.height})`,
        transformOrigin: '0 0',
        backgroundColor: token('--inline-control'),
        color: token('--inline-control-foreground'),
        padding: '0 12px',
      },
      { transform: 'none', transformOrigin: '0 0', backgroundColor: 'transparent', color: token('--bar-foreground'), padding: '0' },
    ], { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
    // Runs once on mount: the travel starts from where the pill was when the toast appeared.
  }, []);
  return <b ref={ref} className="inline-block rounded-sm font-data font-semibold text-bar-foreground">{children}</b>;
}

const useToastManager = Toast.useToastManager<ToastData>;

export { ToastNumber, ToastProvider, useToastManager };
export type { ToastData };
