// Figma: Logos — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-449
import type { ComponentProps } from 'react';
import beyondHd from '@/assets/logos/beyondhd-logo.png';
import blutopia from '@/assets/logos/blutopia-logo.svg';
import jellyfinWordmarkDark from '@/assets/logos/jellyfin-banner-dark.svg';
import jellyfinWordmarkLight from '@/assets/logos/jellyfin-banner-light.svg';
import jellyfinBlack from '@/assets/logos/jellyfin-icon-black.svg';
import jellyfinSolidBlack from '@/assets/logos/jellyfin-icon-solid-black.svg';
import jellyfinSolidMonochrome from '@/assets/logos/jellyfin-icon-solid-monochrome.svg';
import jellyfinSolidWhite from '@/assets/logos/jellyfin-icon-solid-white.svg';
import jellyfinWhite from '@/assets/logos/jellyfin-icon-white.svg';
import jellyfin from '@/assets/logos/jellyfin-icon.svg';
import mdblist from '@/assets/logos/mdblist-logo.png';
import plexAppIcon from '@/assets/logos/plex-app-icon.png';
import plexGold from '@/assets/logos/plex-icon-gold.svg';
import plex from '@/assets/logos/plex-icon.svg';
import plexWordmark from '@/assets/logos/plex-logo.svg';
import privateHd from '@/assets/logos/privatehd-logo.png';
import radarr from '@/assets/logos/radarr-logo.svg';
import rtorrent from '@/assets/logos/rutorrent-logo.png';
import sonarr from '@/assets/logos/sonarr-logo.svg';
import tmdb from '@/assets/logos/tmdb-logo.svg';
import trakt from '@/assets/logos/trakt-logo.svg';
import { cn } from '@/lib/utils';

type LogoName = 'sonarr' | 'radarr' | 'rtorrent' | 'plex' | 'plex-gold' | 'plex-wordmark' | 'plex-app-icon' | 'jellyfin' | 'jellyfin-black' | 'jellyfin-white' | 'jellyfin-solid-black' | 'jellyfin-solid-white' | 'jellyfin-solid-monochrome' | 'jellyfin-wordmark-light' | 'jellyfin-wordmark-dark' | 'blutopia' | 'privatehd' | 'beyond-hd' | 'tmdb' | 'mdblist' | 'trakt';

const logos: Record<LogoName, { src: string; alt: string }> = {
  sonarr: { src: sonarr, alt: 'Sonarr' },
  radarr: { src: radarr, alt: 'Radarr' },
  rtorrent: { src: rtorrent, alt: 'rTorrent' },
  plex: { src: plex, alt: 'Plex' },
  'plex-gold': { src: plexGold, alt: 'Plex' },
  'plex-wordmark': { src: plexWordmark, alt: 'Plex' },
  'plex-app-icon': { src: plexAppIcon, alt: 'Plex' },
  jellyfin: { src: jellyfin, alt: 'Jellyfin' },
  'jellyfin-black': { src: jellyfinBlack, alt: 'Jellyfin' },
  'jellyfin-white': { src: jellyfinWhite, alt: 'Jellyfin' },
  'jellyfin-solid-black': { src: jellyfinSolidBlack, alt: 'Jellyfin' },
  'jellyfin-solid-white': { src: jellyfinSolidWhite, alt: 'Jellyfin' },
  'jellyfin-solid-monochrome': { src: jellyfinSolidMonochrome, alt: 'Jellyfin' },
  'jellyfin-wordmark-light': { src: jellyfinWordmarkLight, alt: 'Jellyfin' },
  'jellyfin-wordmark-dark': { src: jellyfinWordmarkDark, alt: 'Jellyfin' },
  blutopia: { src: blutopia, alt: 'Blutopia' },
  privatehd: { src: privateHd, alt: 'PrivateHD' },
  'beyond-hd': { src: beyondHd, alt: 'Beyond-HD' },
  tmdb: { src: tmdb, alt: 'TMDB' },
  mdblist: { src: mdblist, alt: 'MDBList' },
  trakt: { src: trakt, alt: 'Trakt' },
};

/** The service's or tracker's own logo, 20 px by default. Pass alt="" when its name sits beside it. Plex gold goes only on dark grounds (the black button, the dark first-run pick, the setup strip's connected pill); Jellyfin black only on the Jellyfin button. */
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
