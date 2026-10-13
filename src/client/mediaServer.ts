import { createContext } from 'react';

// The owner's media server from /api/session; refresh re-reads it after a switch.
export const MediaServerContext = createContext<{ name: 'plex' | 'jellyfin'; refresh: () => void }>({ name: 'plex', refresh: () => undefined });
