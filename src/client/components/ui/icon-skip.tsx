// v2/Icon/SkipBack10 — https://www.figma.com/design/5XDOiiHT4DNqDRgYkgbe5y?node-id=15-1199
// v2/Icon/SkipForward30 — https://www.figma.com/design/5XDOiiHT4DNqDRgYkgbe5y?node-id=15-1205
import type { SVGProps } from 'react';

type SkipIconProps = Omit<SVGProps<SVGSVGElement>, 'children'>;

/** lucide rotate-ccw or rotate-cw at 2 px with the seconds drawn inside in the data font. Sized by the parent, like a lucide icon. */
function skipIcon(arc: string, arrow: string, seconds: string) {
  return function SkipIcon(props: SkipIconProps) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" {...props}>
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={arc} />
          <path d={arrow} />
        </g>
        <text x="12" y="11" textAnchor="middle" dominantBaseline="central" fill="currentColor" fontSize="9" fontWeight="700" className="font-data">
          {seconds}
        </text>
      </svg>
    );
  };
}

const SkipBack10 = skipIcon('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5', '10');
const SkipForward30 = skipIcon('M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8', 'M21 3v5h-5', '30');

export { SkipBack10, SkipForward30 };
