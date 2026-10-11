// v2/Breadcrumb — design/design-system.lib.pen K5LLLh
import { ChevronRight } from 'lucide-react';
import { Fragment, type ComponentProps, type MouseEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type BreadcrumbLink = { label: ReactNode; href: string; onClick?: (event: MouseEvent<HTMLAnchorElement>) => void };

/** Where a title, season or episode page sits: links, chevrons, then the current page. */
function Breadcrumb({ links, current, className, ...props }: ComponentProps<'nav'> & { links: BreadcrumbLink[]; current: ReactNode }) {
  const separator = <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-subtle-foreground" />;
  return (
    <nav aria-label="Breadcrumb" className={cn('flex h-6 min-w-0 items-center gap-1.5 font-ui text-sm', className)} {...props}>
      {links.map((link, index) => (
        <Fragment key={index}>
          <a
            href={link.href}
            onClick={link.onClick}
            className="shrink-0 rounded-sm font-medium text-muted-foreground transition-colors duration-(--duration-fast) ease-out hover:text-foreground hover:underline active:text-primary-pressed active:duration-0 focus-ring"
          >
            {link.label}
          </a>
          {separator}
        </Fragment>
      ))}
      <span aria-current="page" className="min-w-0 truncate font-semibold text-foreground">{current}</span>
    </nav>
  );
}

export { Breadcrumb };
export type { BreadcrumbLink };
