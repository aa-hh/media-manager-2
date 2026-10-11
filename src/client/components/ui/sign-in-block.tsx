// v2/Sign-in/block — design/design-system.lib.pen X2BYp
import type { ReactNode, Ref } from 'react';
import { cn } from '@/lib/utils';

type SignInBlockProps = {
  heading: string;
  /** Lets the page move focus to the heading when the state changes. */
  headingRef?: Ref<HTMLHeadingElement>;
  /** One or two paragraphs of body text. */
  body: ReactNode[];
  /** A StatusInline above the heading, such as "Signed out." */
  status?: ReactNode;
  /** The product name above everything; off when the app bar already shows it. */
  productName?: ReactNode;
  /** The large Plex Button, then ghost Buttons such as Try again and Cancel. */
  buttons?: ReactNode;
  /** The trademark line; the page shows it at its bottom left, 24 px above the edge. */
  attribution?: ReactNode;
  className?: string;
};

/**
 * Sign-in page content, 400 px wide, placed on the 40 px page margin.
 * When the state changes, heading and body fade in again (duration-base, ease-out); the buttons change at once.
 */
function SignInBlock({ heading, headingRef, body, status, productName, buttons, attribution, className }: SignInBlockProps) {
  return (
    <div className={cn('flex w-100 flex-col', className)}>
      {productName !== undefined && <p className="pb-8 font-ui text-[13px] font-semibold text-muted-foreground">{productName}</p>}
      {status}
      {/* Keyed by the heading so each new state mounts again and fades in. */}
      <div key={heading} className="flex flex-col transition-opacity duration-(--duration-base) ease-out starting:opacity-0">
        <h1 ref={headingRef} tabIndex={-1} className="outline-none font-ui text-4xl leading-[1.15] font-extrabold tracking-[-0.5px] text-foreground">{heading}</h1>
        <div className="flex flex-col gap-3 pt-5 pb-8">
          {body.map((paragraph, index) => (
            <p key={index} className="font-ui text-base leading-normal font-normal text-muted-foreground">{paragraph}</p>
          ))}
        </div>
      </div>
      {buttons !== undefined && <div className="flex gap-2">{buttons}</div>}
      {attribution !== undefined && (
        <p className="fixed bottom-6 left-(--page-margin) w-100 font-ui text-[13px] leading-[1.45] font-normal text-muted-foreground">{attribution}</p>
      )}
    </div>
  );
}

export { SignInBlock };
