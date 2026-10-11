// Logo/* — design/design-system.lib.pen u3D0O5 (Sonarr) T1cDmD (Radarr) YJlCi (rTorrent) hNlc0 (Plex) zYSrG (Plex gold) z7AOoy (Blutopia) i2QZW (PrivateHD) dofWM (Beyond-HD)
import type { ComponentProps } from 'react';
import beyondHd from '@/assets/logos/beyondhd-logo.png';
import blutopia from '@/assets/logos/blutopia-logo.svg';
import plexGold from '@/assets/logos/plex-icon-gold.svg';
import plex from '@/assets/logos/plex-icon.svg';
import privateHd from '@/assets/logos/privatehd-logo.png';
import radarr from '@/assets/logos/radarr-logo.svg';
import rtorrent from '@/assets/logos/rutorrent-logo.png';
import sonarr from '@/assets/logos/sonarr-logo.svg';
import { cn } from '@/lib/utils';

type LogoName = 'sonarr' | 'radarr' | 'rtorrent' | 'plex' | 'plex-gold' | 'blutopia' | 'privatehd' | 'beyond-hd';

const logos: Record<LogoName, { src: string; alt: string }> = {
  sonarr: { src: sonarr, alt: 'Sonarr' },
  radarr: { src: radarr, alt: 'Radarr' },
  rtorrent: { src: rtorrent, alt: 'rTorrent' },
  plex: { src: plex, alt: 'Plex' },
  'plex-gold': { src: plexGold, alt: 'Plex' },
  blutopia: { src: blutopia, alt: 'Blutopia' },
  privatehd: { src: privateHd, alt: 'PrivateHD' },
  'beyond-hd': { src: beyondHd, alt: 'Beyond-HD' },
};

/** The service's or tracker's own logo, 20 px by default. Pass alt="" when its name sits beside it. Plex gold goes only on the black button. */
function Logo({ name, alt, className, ...props }: Omit<ComponentProps<'img'>, 'src'> & { name: LogoName }) {
  const logo = logos[name];
  return <img src={logo.src} alt={alt ?? logo.alt} width={20} height={20} className={cn('size-5 shrink-0 object-contain', className)} {...props} />;
}

/** Tracker logo name from an indexer's text, or undefined when there is none. */
function trackerLogo(text: string): LogoName | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('beyond')) return 'beyond-hd';
  if (lower.includes('privatehd')) return 'privatehd';
  if (lower.includes('blutopia')) return 'blutopia';
  return undefined;
}

/** Tracker name as the design writes it, or the text unchanged when it matches none. */
function trackerName(text: string): string {
  const logo = trackerLogo(text);
  return logo === undefined ? text : logos[logo].alt;
}

export { Logo, trackerLogo, trackerName };
export type { LogoName };
