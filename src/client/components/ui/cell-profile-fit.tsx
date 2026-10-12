// v2/Cell/profile-fit — ~/Projects/media-manager-2-design/design-system.lib.pen rolXw
import { Check, TriangleAlert, X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type ProfileFit = 'meets' | 'rejected' | 'warning';

const looks = {
  meets: { Icon: Check, tone: 'text-muted-foreground' },
  rejected: { Icon: X, tone: 'text-destructive' },
  warning: { Icon: TriangleAlert, tone: 'text-warning' },
} as const;

/** How a release fits the quality profile, in words: the custom format score, the real reason, or the warning. */
function CellProfileFit({ fit, className, children, ...props }: ComponentProps<'span'> & { fit: ProfileFit }) {
  const { Icon, tone } = looks[fit];
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1 font-data text-sm', tone, className)} {...props}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  );
}

export { CellProfileFit };
export type { ProfileFit };
