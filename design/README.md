# Design files

Light mode, desktop first. Open and edit these in pen.dev; never edit a `.pen` file by hand.

| File | What it holds |
|---|---|
| `design-system.lib.pen` | The pen.dev library: tokens (shadcn names), every v2 component, service logos |
| `library-search.pen` | Library (`/`) and search results (`/search`) |
| `title.pen` | Show and movie pages: overview, adding, monitoring, range select, episode details, deletes |
| `releases.pen` | Pick a release and Grab, including already owned and after Grab |
| `downloads.pen` | Downloads (`/downloads`), manual import, mark as failed |
| `flagged-health.pen` | Flagged (`/flagged`) and Health (`/health`) |
| `history.pen` | History (`/history`) and Blocklist (`/blocklist`) |
| `calendar.pen` | Calendar (`/calendar`): week, month, forecast |
| `settings.pen` | Settings |
| `sign-in.pen` | Plex sign-in and sign out |
| `setup-wizard.pen` | First-run setup wizard: each part's step, testing and failure states, the "How the pieces connect" map, Done |
| `discovery.pen` | Discover (`/discover`) |
| `archive/mediaManager2-2026-10-11.pen` | The single design file before the 11 Oct 2026 split, including every dark screen. Reference only. |

Phone versions of a screen go in the same file as its desktop version.

## Rules

- Every screen file imports `design-system.lib.pen`. Change a component or token there, save, and reopen the screen files to pick it up.
- Copying a screen from one `.pen` file and pasting it into another cuts its link to the library: components arrive as plain frames and tokens as duplicates. To start a new screen file, copy an existing screen file on disk, in this folder (the library link is a relative path), then delete the screens you don't need.
- pen.dev writes to disk only on Cmd+S. Save before committing.
- Agents editing through pen.dev's tools can reach any file open in a pen.dev tab. A path to a file that isn't open silently edits the file in front instead.
