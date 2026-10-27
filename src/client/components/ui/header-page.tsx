// Figma: HeaderPage — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-9197
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type HeaderPageProps = Omit<ComponentProps<'header'>, 'title'> & {
  title: ReactNode;
  /** Data-font line after the title; wrap risk words in their own red span. */
  summary?: ReactNode;
  /** A Breadcrumb, on sub-pages only. */
  breadcrumb?: ReactNode;
  /** One line of reading text under the title row. */
  note?: ReactNode;
  /** An outline Button at the right of the title row. */
  action?: ReactNode;
};

/** Top of every list page. The 40 px side margin comes from the page. */
function HeaderPage({ title, summary, breadcrumb, note, action, className, ...props }: HeaderPageProps) {
  return (
    <header className={cn('flex w-full flex-col gap-1.5 pt-6 pb-4', className)} {...props}>
      {breadcrumb}
      <div className="flex w-full items-center gap-4">
        <h1 className="shrink-0 font-ui text-[26px] font-bold tracking-[-0.3px] text-foreground">{title}</h1>
        <p className="min-w-0 flex-1 font-data text-[15px] font-normal text-muted-foreground">{summary}</p>
        {action}
      </div>
      {note !== undefined && <p className="max-w-170 font-ui text-sm leading-normal font-normal text-muted-foreground">{note}</p>}
    </header>
  );
}

export { HeaderPage };
