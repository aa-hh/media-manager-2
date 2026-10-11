# Issue tracker: Linear

Issues and specs for this repo live in Linear: team **Aa-hh** (key `AA`), initiative **Media Manager 2 v1**. Use the Linear tools (the Linear MCP server), not files and not `gh issue`.

The initiative holds one project per epic plus one for planning:

| Project | Holds |
| --- | --- |
| `P-AA-1` media-manager-2 | The map (AA-5) and its decision tickets (research, grilling, prototype) |
| `P-AA-2` V1 · Library, title pages and calendar | Epic AA-30 and its build tickets |
| `P-AA-3` V1 · Search, release selection and replace | Epic AA-31 and its build tickets |
| `P-AA-4` V1 · Sign-in, connections and hosting | Epic AA-29 and its build tickets |
| `P-AA-5` V1 · Second versions and safe deletion | Epic AA-32 and its build tickets |
| `P-AA-6` V1 · Live downloads and automatic fixes | Epic AA-33 and its build tickets |
| `P-AA-7` V1 · Flags, history and health | Epic AA-34 and its build tickets |

## Conventions

- Every issue goes in team `AA`. A build ticket goes in its epic's project; a planning ticket goes in `P-AA-1`. Don't create new projects.
- A feature's spec (an epic) is a parent issue; its implementation tickets are sub-issues of it, one per ticket, in the same project. Never one combined tickets issue.
- Triage state is a label on the issue (see `triage-labels.md` for the role strings). Linear's workflow status (Todo, In Progress, Done) tracks progress separately.
- Comments and conversation history go in the issue's comments.
- Every mention of a ticket carries its title on first use, in replies, commit messages, PR bodies, comments and docs: `AA-38 (Connect Sonarr, Radarr, rTorrent and Plex through saved settings)`, never a bare `AA-38`. The owner reads the number as noise without the name.

## When a skill says "publish to the issue tracker"

Create the issue in team `AA`, in the project the table above gives it. Return its identifier (for example `AA-12`).

## When a skill says "fetch the relevant ticket"

Look the issue up by identifier (`AA-12`) or URL with the Linear tools. The user will normally pass the identifier.

## Wayfinding operations

Used by `/wayfinder`.

- **Map**: an issue in `P-AA-1` labelled `wayfinder:map`; its description is the map body.
- **Child ticket**: a sub-issue of the map (set `parentId`), labelled `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Planning types stay in `P-AA-1`; an epic (`task`) gets its own `V1 · …` project.
- **Blocking**: Linear's native "blocked by" relation. A ticket is unblocked when every blocker is Done or Canceled.
- **Frontier**: the map's sub-issues that are open, unblocked, and unassigned; lowest identifier number first.
- **Claim**: assign the issue to the person driving the map before any work.
- **Resolve**: post the answer as a comment, set status to Done, then append a context pointer (name + link + one-line gist) to the map's Decisions so far.
- **Out of scope**: set status to Canceled and add a line to the map's Out of scope section.
