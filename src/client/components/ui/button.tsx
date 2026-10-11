import { Button as ButtonPrimitive } from '@base-ui/react/button';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type ButtonProps = ComponentProps<typeof ButtonPrimitive> & {
  variant?: 'outline' | 'quiet';
};

function Button({ className, variant = 'outline', type = 'button', ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      type={type}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-3 rounded-lg px-4 py-2.5 text-[0.9375rem] font-semibold leading-5 transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]',
        'disabled:cursor-not-allowed disabled:opacity-55',
        variant === 'outline'
          ? 'border border-[var(--border)] bg-[var(--control)] text-[var(--ink)] hover:bg-[var(--control-hover)]'
          : 'bg-transparent text-[var(--secondary-ink)] hover:bg-[var(--quiet-hover)] hover:text-[var(--ink)]',
        className,
      )}
      {...props}
    />
  );
}

export { Button };
