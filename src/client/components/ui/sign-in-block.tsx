// v2/Sign-in/block — matches the "Screens round 5" planet screens in design/sign-in.pen
import type { Ref } from 'react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';

type SignInBlockProps = {
  /** Spinner look on the button. */
  busy: boolean;
  /** The sentence under the button; nothing is shown when undefined. */
  line?: string;
  onSignIn: () => void;
  /** Lets the page move focus to the heading. */
  headingRef?: Ref<HTMLHeadingElement>;
  className?: string;
};

/** Product name and the Plex button on the dark sign-in page; the line sits 12 px under the button, outside the flow, so nothing above it moves. */
function SignInBlock({ busy, line, onSignIn, headingRef, className }: SignInBlockProps) {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <h1 ref={headingRef} tabIndex={-1} className="outline-none font-ui text-4xl leading-[1.15] font-extrabold tracking-[-0.5px] text-[#ece9e1]">media-manager-2</h1>
      <div className="relative">
        <Button
          variant="plex"
          size="large"
          loading={busy}
          onClick={onSignIn}
        >
          <span className="inline-flex items-center gap-2">
            <Logo name="plex" alt="" className="size-4" />
            Log in with Plex
          </span>
        </Button>
        {line !== undefined && (
          <p className="absolute left-0 top-[calc(100%+12px)] font-ui text-sm leading-[21px] text-[#cdb08e] sm:whitespace-nowrap">{line}</p>
        )}
      </div>
    </div>
  );
}

export { SignInBlock };
