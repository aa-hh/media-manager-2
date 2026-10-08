# Issue tracker: Linear

Issues and specs for this repo live in Linear: team **Aa-hh** (key `AA`), project **media-manager-2** (ID `P-AA-1`, https://linear.app/aa-hh/project/media-manager-2-056a503d71d3). Use the Linear tools (the Linear MCP server), not files and not `gh issue`.

## Conventions

- Every issue goes in team `AA` and project `P-AA-1`. Don't create new projects.
- A feature's spec is a parent issue; its implementation tickets are sub-issues of it, one per ticket. Never one combined tickets issue.
- Triage state is a label on the issue (see `triage-labels.md` for the role strings). Linear's workflow status (Todo, In Progress, Done) tracks progress separately.
- Comments and conversation history go in the issue's comments.

## When a skill says "publish to the issue tracker"

Create the issue in team `AA`, project `P-AA-1`. Return its identifier (for example `AA-12`).

## When a skill says "fetch the relevant ticket"

Look the issue up by identifier (`AA-12`) or URL with the Linear tools. The user will normally pass the identifier.

## Wayfinding operations

Used by `/wayfinder`.

- **Map**: an issue in `P-AA-1` labelled `wayfinder:map`; its description is the map body.
- **Child ticket**: a sub-issue of the map (set `parentId`), labelled `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`).
- **Blocking**: Linear's native "blocked by" relation. A ticket is unblocked when every blocker is Done or Canceled.
- **Frontier**: the map's sub-issues that are open, unblocked, and unassigned; lowest identifier number first.
- **Claim**: assign the issue to the person driving the map before any work.
- **Resolve**: post the answer as a comment, set status to Done, then append a context pointer (name + link + one-line gist) to the map's Decisions so far.
- **Out of scope**: set status to Canceled and add a line to the map's Out of scope section.
