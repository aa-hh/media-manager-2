# Handover: v2 light-mode design, 11 October 2026

You are taking over the media-manager-2 design modernisation. The previous session (worktree `design-modernization-review-d37daf`) restyled the light-mode design, built a new component library, split the design into one file per place in the app, and was about to scope the missing screens. Read this file, `PRODUCT.md`, `CONTEXT.md` and the nearest `AGENTS.md` before acting. Speak to Alec in plain words (see his global CLAUDE.md).

## Where things are

Design work lives in the **`codex-design-finish` worktree** (`/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/codex-design-finish`, branch `codex/design-finish`, local commits not pushed). This session's worktree cannot write there (an app guard blocks Edit/Write across worktrees); git commands through Bash work. A new session should be started **in the `codex-design-finish` folder** so it can write DESIGN.md and the README directly.

`design/` in that worktree:

| File | Holds |
|---|---|
| `design-system.lib.pen` | pen.dev library: 86 tokens with shadcn names, 79 components (`v2/...`), service logos |
| `library-search.pen` | v2 Library, Search results |
| `title.pen` | v2 TV overview in library, Episode details expanded |
| `releases.pen` | v2 Pick a release inline under episode, Grab already owned, Pick a release after Grab |
| `settings.pen` | v2 Settings all connected, Settings problems and unsaved edits |
| `downloads.pen`, `flagged-health.pen`, `history.pen`, `calendar.pen`, `sign-in.pen` | empty, library already imported |
| `archive/mediaManager2-2026-10-11.pen` | the whole pre-split file: every old dark and old light screen. Reference only. |

Commits on `codex/design-finish`: `a00f913` restore point, `4d353dd` slimmed to v2 and tokens renamed, `1d62c4d` library added, `ec47c5d` 8 Oct DESIGN.md edits recorded, `17eaa60` split into area files (mediaManager2.pen removed).

Today's critique reports and the screen inventory (ids of every archived screen): `docs/design/critiques/2026-10-11/` in this worktree (`design-modernization-review-d37daf`).

## Decisions Alec made (do not reopen)

- Light mode only for now; dark work is archived. Desktop first; phone secondary.
- Direction: paper white and black with lime (old direction 3), with direction 1's corners (4 to 10px) and shadow rule (soft shadows only on floating things), and direction 2's density (40px rows, 40px desktop page margin, 8 posters per row).
- Colour meanings: black = actions and "on"; lime only for the best release and live downloads, only as a fill (fails contrast as text or thin lines on white); destructive red = risk; amber warning = missing, warning, pending; grey tint + side bar = selection.
- Controls: 28px only inside table rows and dense lists, 40px default elsewhere, 48px for the one main action on a page or panel. Inputs, selects, toggle groups match. Search is a 48px field centred in a 64px app bar, 560 to 720px wide (Seerr/Plex style).
- One component per thing; states are instance overrides (pen.dev has no variants). Sizes come from `control-h/px/text/radius/icon-row|default|large` tokens (pen.dev drops a variable on height, so heights are typed numbers matching the tokens).
- Token names follow shadcn (`background`, `foreground`, `card`, `muted`, `primary`, `destructive`, `border`, `input`, `ring`, ...) plus extras (`best`, `live`, `warning`, `subtle-foreground`, `faint-foreground`, `bar`, ...). The app code still uses its own names (`--ink`, `--secondary-ink`, `--control`, `--focus`, `--ground`, an older `--mm-*` set); renaming the code is implementation work.
- File structure: one `.pen` per place in the app (above). Pick a release has its own file. Flagged + Health share one; History + Blocklist share one.
- Design work gets no reviewer step; the orchestrator checks screenshots itself.

## pen.dev rules learned the hard way

- pen.dev tools reach any `.pen` file **open in a pen.dev tab**. A `filePath` to a file that is not open silently edits the file **in front** instead (this deleted nine screens once; recovered with Cmd+Z). Before writing to a file, insert a frame named `marker <file>`, read it back from that path, confirm only that marker is there, then delete it. Identical copies make content checks useless; the marker is the only proof.
- pen.dev writes to disk only when Alec presses Cmd+S. Check file times before committing.
- Copy and paste between `.pen` files cuts every library link (components arrive as plain frames, tokens duplicated). To make a new screen file, copy an existing linked file on disk **in the same folder as the library** (the import is a relative path), then delete screens you don't need.
- Each file imports the library under its own alias (seen `5:` and `s:`). Refs look like `5:ht3RN`; override paths need the prefix on every segment (`5:OIwjX/5:RigzS`); tokens `$5:background`. Discover the alias from the top-level `<alias>:x1g4a` frames.
- Whole-document `Get` visitors often crash with "cannot read property of undefined". Walk `Get(id,{depth:N}).children` yourself.
- pen.dev froze and dropped the connection with three agents writing heavily at once. Keep it to two writers, small execute calls, screenshots only at the end of a section.
- Each screen file still holds an unused local copy of the 86 tokens (unprefixed). Removing them safely is untested.

## Agent setup changed today (needs a new session to load)

- `~/.claude/agents/fable-scoper.md` and `~/.claude/agents/work-order-reviewer.md` now list `ToolSearch, mcp__pencil__get_app_state, mcp__pencil__read_skill, mcp__pencil__execute` and a `PreToolUse` hook on `mcp__pencil__execute` running `~/.claude/hooks/pencil-readonly.sh`. The script refuses any execute call (including `edits` retries) that contains `Insert(`, `Copy(`, `Update(`, `Replace(`, `Move(`, `Delete(`, `Generate(`, `SetVariables(` or `Export(`. It passed pipe tests.
- **First task: prove it inside an agent.** Launch `work-order-reviewer` (model sonnet is fine) with: load `mcp__pencil__execute` via ToolSearch; call it on `design/design-system.lib.pen` (absolute path, file open in pen.dev) with `Delete("zzzzzzNOPE")`, then with `let t=[];Get((n,c)=>{if(!c.parentCtx)t.push(n.id);c.skipChildren()});Print(t.join(","))`. Expected: call 1 refused by the hook, call 2 prints `Iahma,x1g4a,r7eDFX,Mm8Xf,dJZBi,yawBw`. If the hook does not fire, report to Alec before using these agents on design files.

## Open work

1. **Scope and build every missing screen and state, plus transitions and animations** (Alec's request, via `/scope-and-run`; each agent uses the impeccable skill where useful). The first scoper was stopped so it could be relaunched with pen.dev access. Brief it with: the inventory (`docs/design/critiques/2026-10-11/inventory.md`), the critiques, PRODUCT.md capabilities 1 to 16, the app's real states in `src/client` (Home.tsx routes, PickRelease.tsx, title/, downloads/, health/, flagged/, history/ incl. Blocklist, calendar/, SignIn.tsx, library/). Deliverables: every archived screen redone in v2 plus every state the code or PRODUCT.md implies (empty, loading, error, partial, confirmation, undo, problems); consistent sample data with the existing v2 screens (Severance S02, Dune search, Andor imported, 3 downloads, Civil War gave up searching); a motion system (duration tokens in the library, a motion sheet documenting each transition with trigger, property, duration token, easing, reduced-motion fallback; before/mid/after storyboard frames in each screen file for its key transitions); any missing library components built first by a single library-only track, then Alec saves and reopens the screen files, then at most two screen tracks at a time, phone last and optional. Executors verify with a screenshot pass, a clipping check and a checklist; no reviewer, no PNG exports. Nobody commits.
2. **DESIGN.md is done:** commit `6ecb6e2` (DESIGN.md, `.impeccable/design.json`, `design/README.md`) is merged into `codex/design-finish`. Still stale: `.impeccable/surfaces/design-mediamanager2-pen.md` points at the removed `design/mediaManager2.pen`. A cloud session started for the same task cannot see these files; Alec can stop it.
3. **Library fixes still open** (in `design-system.lib.pen`):
   - the `row` token is a colour `#000000`, but the Tokens sheet describes it as the 40px row height;
   - `radius-xl` is 14, outside the 4 to 10px range (shadcn slot, unused);
   - sheet notes are stale: Select says 36px and ToggleGroup 30px (components are 40px), and notes still use old colour names (`ink-2`, `line-strong`, `risk`);
   - `detail-indent` is 133 but the episode-details note says 136;
   - Button two-key hint (Shift + R) was skipped because editing Button timed out (too many instances);
   - two disk-use examples on sheet `Mm8Xf` (`K72sxW`, `pAPgT`) may have lost a note.
4. Push `codex/design-finish` and update PR 4 once Alec agrees.
