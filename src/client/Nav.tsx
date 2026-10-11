import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { Screen } from './route';

const links: { screen: Screen; path: string; label: string }[] = [
  { screen: 'downloads', path: '/', label: 'Downloads' },
  { screen: 'flagged', path: '/flagged', label: 'Flagged' },
  { screen: 'history', path: '/history', label: 'History' },
  { screen: 'health', path: '/health', label: 'Health' },
];

export function Nav({ screen, needsYou, healthBadge, onNavigate }: { screen: Screen; needsYou: number; healthBadge: ReactNode; onNavigate: (path: string) => void }) {
  return (
    <nav className="flex shrink-0 items-center gap-4">
      {links.map((link) => (
        <a
          key={link.screen}
          href={link.path}
          aria-current={screen === link.screen ? 'page' : undefined}
          onClick={(event) => { event.preventDefault(); onNavigate(link.path); }}
          className={cn('font-ui text-[13px] font-medium', screen === link.screen ? 'text-[var(--mm-ink)]' : 'text-[var(--mm-ink-2)]')}
        >
          {link.label}
          {link.screen === 'flagged' && needsYou > 0 && ` ${needsYou}`}
          {link.screen === 'health' && healthBadge !== null && <span className="ml-1 text-[var(--mm-risk)]">{healthBadge}</span>}
        </a>
      ))}
    </nav>
  );
}
