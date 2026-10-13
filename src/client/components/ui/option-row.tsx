// v2/Option row — ~/Projects/media-manager-2-design/design-system.lib.pen qq4VX
// v2/Option row/bordered — ~/Projects/media-manager-2-design/design-system.lib.pen zDrOf (the `bordered` prop)
// v2/Option row/bordered/service — ~/Projects/media-manager-2-design/design-system.lib.pen UhcoW (OptionRowService)
import { ChevronRight } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';

type OptionRowProps = ComponentProps<'label'> & {
  /** A Radio (inside a RadioGroup) or a Checkbox. Selection shows in the control, never as a tint. */
  control: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  kbd?: ReactNode;
  /** A card with its own edge, for a choice that stands alone: 2 px black edge when on (the second pixel is an inset shadow, so nothing moves). */
  bordered?: boolean;
};

/** A radio or checkbox with a title and a line of explanation. The focus ring wraps the whole row. */
function OptionRow({ control, title, description, kbd, bordered = false, className, ...props }: OptionRowProps) {
  return (
    <label
      className={cn(
        'group flex w-full gap-2.5 rounded-sm p-2.5',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0',
        'not-has-data-disabled:hover:bg-surface-hover not-has-data-disabled:active:bg-surface-pressed',
        'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
        '[&>[data-control]>*]:focus-visible:outline-none',
        bordered && 'rounded-md border border-border bg-card px-4 py-3.5 has-data-checked:border-foreground has-data-checked:shadow-[inset_0_0_0_1px_var(--foreground)]',
        className,
      )}
      {...props}
    >
      <span data-control="" className="flex shrink-0">{control}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-ui text-sm font-semibold text-foreground group-has-data-disabled:text-faint-foreground">{title}</span>
        {description !== undefined && (
          <span className="font-ui text-[13px] leading-[1.4] text-muted-foreground group-has-data-disabled:text-faint-foreground">{description}</span>
        )}
      </span>
      {kbd !== undefined && <Kbd>{kbd}</Kbd>}
    </label>
  );
}

type OptionRowServiceProps = ComponentProps<'button'> & {
  /** The service's 32 px logo, such as <Logo name="plex" alt="" className="size-8" />. */
  logo: ReactNode;
  title: ReactNode;
  description?: ReactNode;
};

/** Pick a media server on the dark sign-in ground: a bordered row with the service's logo and a chevron. It opens the next step; it records no choice. */
function OptionRowService({ logo, title, description, type = 'button', className, ...props }: OptionRowServiceProps) {
  return (
    <button
      type={type}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md border border-white/12 bg-card-on-dark px-4 py-3.5 text-left',
        'transition-colors duration-(--duration-fast) ease-out hover:border-input-on-dark focus-ring-on-dark',
        className,
      )}
      {...props}
    >
      <span className="flex size-8 shrink-0 items-center justify-center">{logo}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-ui text-sm font-semibold text-foreground-on-dark">{title}</span>
        {description !== undefined && <span className="font-ui text-[13px] leading-[1.4] text-muted-foreground-on-dark">{description}</span>}
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground-on-dark" />
    </button>
  );
}

export { OptionRow, OptionRowService };
