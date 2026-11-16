// v2/SectionLabel — https://www.figma.com/design/dFQMjELOx6ObLS0qOG3NCF?node-id=38-544
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Where a title page sits, borrowed from Plex: the section 18/600 over the place 13 in the data font. The whole label links back there. */
function SectionLabel({ label, place, className, ...props }: ComponentProps<'a'> & { label: ReactNode; place: ReactNode }) {
  return (
    <a
      className={cn('group flex w-fit min-w-0 flex-col rounded-xs focus-ring', className)}
      {...props}
    >
      <span className="font-ui text-lg leading-tight font-semibold text-foreground transition-colors duration-(--duration-fast) ease-out group-hover:underline group-active:text-primary-pressed group-active:duration-0">{label}</span>
      <span className="max-w-60 truncate font-data text-[13px] text-muted-foreground">{place}</span>
    </a>
  );
}

export { SectionLabel };
