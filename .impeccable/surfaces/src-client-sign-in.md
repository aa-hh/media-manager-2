---
version: 1
slug: "src-client-sign-in"
primary_target: "src/client/SignIn.tsx"
related_targets:
  - "src/client/main.tsx"
  - "src/client/globals.css"
---

# Owner sign-in

Mode: Operate.

The selected direction is light Modern utility. The sign-in screen uses Inter on `#F6F8F7`, with `#152123` primary text, `#53605F` secondary text, white controls, `#DAE2DF` borders and `#233B35` focus outlines. The narrow, left-aligned group contains the product name, one heading, a short explanation and the actions required by the current state. It has no sidebar, preview, service status, card or sign-up path.

The screen covers initial sign-in, opening Plex, checking the account, an unclaimed PIN, an interrupted handoff, wrong owner, Plex failure, missing configuration, expired or invalid attempts, expired sessions and retry or cancellation. The signed-in screen retains the existing `media-manager-2` heading and adds Sign out. Successful sign-out returns to the initial screen and uses a screen-reader announcement. Failed sign-out says that the session may still be active.

Controls use native button behavior through Base UI, visible dark-green focus outlines and a minimum 44px height. State changes focus the relevant heading. Progress and errors use polite announcements. The layout keeps 24px phone margins and fits at 320px without horizontal scrolling.

Visual references were inspected in `/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/codex-design-finish/design/mediaManager2.pen`: `G0oVq`, History `EGUPz`, Downloads `K7IEj`, shared controls `bi8Au` and Sidequest `Le3r1`. The current `DESIGN.md` describes an older dark direction for this surface; the owner-selected light direction governs this screen.

The Plex icon comes unchanged from `https://app.plex.tv/auth/favicon-mask.svg`. Its SHA-256 is `5b2a8cf07e39bc5dbc807cff19ae5e36c640c571488b789c3cb87f1c3f9ba1ff`; its 72×72 viewBox and native black fill remain unchanged. Plex trademark guidance permits the icon as a Plex link, but direct retrieval of the current legal page returned 403, so this is not a complete current legal review.

Inter and its complete SIL Open Font License come from `https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf` and `https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt`. The font SHA-256 is `29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031`.

The owner also requires 26 new editable Pen frames that match the implementation: desktop and phone frames for Initial, Opening Plex, Checking Plex account, Pending, Wrong owner, Plex unavailable, Sign-in not configured, Attempt expired, Session expired, Signed in, Signing out, Sign-out failed and Signed out. Existing Pen nodes, variables, themes and bindings stay unchanged.

The new frames in the active Pen canvas are:

| State | Desktop | Phone |
| --- | --- | --- |
| Initial | `YIKOI` | `enXfL` |
| Opening Plex | `FEVzb` | `ncANJ` |
| Checking Plex account | `my0AC` | `dwTz8` |
| Pending | `g42xjJ` | `O9LdN5` |
| Wrong owner | `kU2e6` | `V2XImO` |
| Plex unavailable | `JzkZu` | `a9hn3M` |
| Sign-in not configured | `VInOQ` | `KorRG` |
| Attempt expired | `q6A0O` | `PS6ye` |
| Session expired | `evJ01` | `VsIny` |
| Signed in | `hoMhL` | `tJYuo` |
| Signing out | `SubcH` | `Mb0uQ` |
| Sign-out failed | `hP94U` | `thFcr` |
| Signed out | `N2fXn` | `HJiFu` |

Desktop frames are 1440×900. Phone frames are 390×844. The first Pen MCP inspection reported 56 top-level nodes: the 30 existing nodes retained their names and bounds, and the 26 new frames had no placeholders, overlaps, forbidden reference/browser/image layers or layout warnings. MCP screenshots of every new frame showed the state copy and actions without clipping. The six new icon paths retain the official Plex geometry, 72×72 viewBox and black fill. The Signed out frames record the `Signed out.` screen-reader announcement in their context.

The bounded repair adds four editable frames copied from the task's Pending frames:

| State | Desktop | Phone | MCP image exports |
| --- | --- | --- | --- |
| Cancelling sign-in | `gnhck` | `DOitu` | `../review/aa-37/pen-repair/gnhck.png`, `DOitu.png` |
| Cancellation failed | `jgOax` | `c8KhZ` | `../review/aa-37/pen-repair/jgOax.png`, `c8KhZ.png` |

Cancelling retains the pending heading/body, disables all three actions and labels Cancel as Cancelling…. Context records busy semantics and its live announcement. Cancellation failed uses the implemented heading and explanation with Try cancelling again and Try again. It retains the callback until cancellation succeeds or a replacement attempt supersedes it. It offers no Check again.

The four frames occupy fresh space below the task group with 160px gaps. MCP screenshots and layout inspection confirmed their sizes, copy, line wrapping and unclipped controls; no placeholders or layout problems remained. Actual canvas total is 60 top-level nodes, including 30 task frames. The before/after MCP inventory found no name or bound change among the prior 56 roots and no concurrent additions. `../review/aa-37/repair-pen-inventory.json` records that comparison. Only the four added frames were edited during repair. MCP confirmed image exports, but supplied no save-status result, so on-disk Pen persistence is unverified.
