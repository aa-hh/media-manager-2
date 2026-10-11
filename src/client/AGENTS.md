# src/client

## Purpose

React client for a server that grabs releases and deletes files; a click here has real consequences. The client never decides what is safe, never holds a secret, and never trusts its own state over the server's.

## Rules

- Every path that sends a grab, replace, delete or import is blocked while one is in flight, keyboard included: the server does not deduplicate.
- A target object passed to a loader keeps its identity across renders, or the search reruns.
- Per-release state in Pick a release (overrides, the replace or second version choice) clears when the selection changes, or it rides along with another grab.
- A session re-check never unmounts a verified session; that discards unsaved input and pending Undo.
- The event stream reopens after it closes for good, or live screens freeze.
- Events arriving while a snapshot loads are not applied to the old snapshot; the snapshot would overwrite them.
- A 401 from any request goes to `onUnauthenticated`, never shown as a service refusal.
- Secrets never echo into the page; the server sends only whether each is set.
- `components/ui/` is presentational and never fetches; screens own every request.

## Map

- `main.tsx` → session check and routing by address.
- `Home.tsx`, `Search.tsx`, `SignIn.tsx` → home, search and sign-in screens.
- `PickRelease.tsx` → Pick a release screen and its grab.
- `navigation.ts`, `plexPopup.ts` → in-page navigation; Plex sign-in popup.
- `downloads/` → queue snapshot, event stream, import panel.
- `title/` → movie and series pages.
- `library/` → library grid, live progress, request helpers.
- `settings/` → service connections and tracker rules.
- `calendar/`, `flagged/`, `health/`, `history/` → those screens.
- `components/ui/` → presentational components.
- `lib/`, `assets/`, `globals.css` → class helper, fonts, logos, theme.
