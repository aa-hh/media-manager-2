// Figma: SignInQuickConnectCode — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=13-6084
import { cn } from '@/lib/utils';

type SignInQuickConnectCodeProps = {
  /** The six-digit Quick Connect code; shown as two groups of three. */
  code: string;
  /** The expiry line, such as "Expires in 9:41". */
  expiry: string;
  className?: string;
};

/** The sign-in block's body while Jellyfin Quick Connect waits for approval, on the dark sign-in ground. */
function SignInQuickConnectCode({ code, expiry, className }: SignInQuickConnectCodeProps) {
  return (
    <div className={cn('flex flex-col gap-4 pt-5 pb-2', className)}>
      <p className="font-ui text-base leading-normal text-muted-foreground-on-dark">
        In a Jellyfin app where you're signed in, open your profile, choose Quick Connect and enter this code.
      </p>
      <p className="flex items-center gap-5 font-data text-[64px] leading-none font-semibold tracking-[6px] text-foreground-on-dark">
        <span className="sr-only">{code.split('').join(' ')}</span>
        <span aria-hidden="true">{code.slice(0, 3)}</span>
        <span aria-hidden="true">{code.slice(3)}</span>
      </p>
      <p className="font-ui text-sm leading-normal text-muted-foreground-on-dark">{expiry}</p>
    </div>
  );
}

export { SignInQuickConnectCode };
