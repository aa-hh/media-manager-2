### Goal

Refine only `S3IzNG` (“Episode details / Direction A”) into neutral light mode, preserving its composition and restoring the original compact poster placeholder. Keep all existing content, actions, versions, history and shortcuts. The owner’s light-mode instruction overrides the older dark-palette guidance.

### Verified facts

Pen citations use node IDs because the encrypted document has no readable source lines. All cited nodes were inspected through Pencil.

- Working directory: `/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/codex-design-finish`. Branch: `codex/design-finish`. HEAD: `ec5c8e884f0371c141256fbe76be492edf463940`. Initial and final scoping status: only ` M design/mediaManager2.pen`. Scoping changed nothing.
- Pencil’s active document is that worktree’s `design/mediaManager2.pen`, with `S3IzNG` selected. The frame contains 222 nodes, including 117 text nodes and no component instances. The visible-node check found no clipping. [Pen: `S3IzNG`]
- The frame is 1440×900 at `(3444,3267)`. Navigation is 48px high, workspace 812px and bottom bar 40px. The left column is 342px wide. [Pen: `S3IzNG`, `H5XfN`, `v1KyU7`, `PLCJY`, `yevho`]
- Main surfaces use `#F3F2EE`; the left column and unselected episode rows use `#202831`. [Pen: `S3IzNG`, `lXfHm`, `PLCJY`, `fLoC3`]
- Exactly seven nodes use `#FCFCFA`: five backgrounds (`H5XfN`, `yevho`, `oKMTK`, `IjcVx`, `CzFka`) and two labels on dark controls (`FNnbY`, `I2gmK`). No left-column text uses this colour. [Pen: listed nodes]
- Show context `IpXYd` is 342×129, with four text nodes and no poster. Their positions are `(20,22)`, `(20,58)`, `(20,78)`, `(20,98)`; the widest text is 229px. [Pen: `IpXYd`, `abW8t`, `UJqHN`, `EgvBb`, `iYHkQ`]
- Original episode frame `c9Z57` contains `N2Ft37`, a 48×72 poster placeholder filled `#1f3a33`. A whole-document scan found zero image fills. [Pen: `c9Z57`, `kU9nC`, `N2Ft37`]
- Selected episode `u08lOC` has a 3px left stroke. Season 2 uses selected button `MGz4u` and label `WdrG5`. [Pen: listed nodes]
- Product images must come from Sonarr or Radarr. Dense information serves the owner’s workflow. [`PRODUCT.md:53`, `PRODUCT.md:73`]
- Static designs do not establish working controls or runtime accessibility. Layout changes normally use visual verification. [`DESIGN.md:46`, `DESIGN.md:92`, `AGENTS.md:95`]
- The older surface brief specifies dark colours and poster composition. This task changes the selected frame only. [`.impeccable/surfaces/design-mediamanager2-pen.md:20`, `.impeccable/surfaces/design-mediamanager2-pen.md:24`]

### Steps

1. **Recolour only the `S3IzNG` subtree in `design/mediaManager2.pen`.** Read Impeccable’s `reference/craft-floor.md` immediately before editing and apply `reference/polish.md`. Do not rerun `impeccable context`. Use local properties; leave shared variables and components unchanged.

   | Existing colour or node | Required colour |
   |---|---|
   | `#F3F2EE` fills | `#F5F5F5` |
   | Backgrounds `H5XfN`, `yevho`, `oKMTK`, `IjcVx`, `CzFka` | `#FFFFFF` |
   | Labels `FNnbY`, `I2gmK`, both on dark controls | `#FFFFFF` |
   | `#CED2D1` and `#46515C` divider fills/strokes | `#D1D5DB` |
   | `#202831` fills | `#FAFAFA` |
   | `#35404B` season-button fills | `#E5E7EB` |
   | Text filled `#E8EBE8` | `#171B20` |
   | Text filled `#B8C1C7`, `#9CA8AF`, or `#ABB5BA` | `#58616C` |
   | `MGz4u` selected-season fill | `#171B20` |
   | `WdrG5` selected-season text | `#FFFFFF` |
   | `u08lOC` selected-episode fill | `#E8EEF5` |
   | `#A73D24` risk text | `#B42318` |
   | `#F7E8E1` risk fills | `#FEF2F2` |

   Retain existing `#171B20`, `#58616C`, teal `#236A80` and green `#317158` elsewhere. Preserve stroke widths, typography, dimensions, spacing, content and visibility. Left-column text becomes dark; only the selected-season label remains white on its dark button.

2. **Restore the original poster inside `IpXYd`.** Keep the frame at 342×129 and change its layout to absolute positioning. Keep its four existing text nodes, unchanged content and typography, at:
   - `abW8t`: `(80,22)`
   - `UJqHN`: `(80,58)`
   - `EgvBb`: `(80,78)`
   - `iYHkQ`: `(80,98)`

   Copy `N2Ft37` into `IpXYd`, named “Poster placeholder”, at `(20,22)`. Retain its 48×72 dimensions and `#1f3a33` fill. Leave the source untouched. The widest label ends at x309, inside the 342px column. Keep every node outside `IpXYd` at its original position and size.

### Out of scope — do not touch

- Other frames, including `c9Z57`, original TV frames, sign-in screens and direction variants.
- Shared components, variables, app source, tests, project documents and `.githooks/project.conf`.
- Copy, actions, shortcuts, episode order, version metadata and history.
- New cards, explanatory text, illustrations, responsive variants or broader density changes.
- No fetched or generated artwork. Restore the existing placeholder.
- No cleanup, no abstractions, no error handling for impossible cases, no backwards-compat shims.
- No commits, pushes, pull requests, merges, branch changes or native document switching. The orchestrator owns native saving.

### Verification

**Before editing**, run from the design worktree:

```bash
git branch --show-current
git rev-parse HEAD
git status --short
```

Expected baseline: branch and HEAD above; ` M design/mediaManager2.pen`. Preserve existing edits.

Call `mcp__pencil__get_app_state({})`. The active path must exactly match the design worktree document. Do not rely on `execute.filePath` to switch documents.

Through Pencil, capture `TakeScreenshot(["S3IzNG"])` and record existing node IDs, text content, geometry and visibility. Record outside-target node properties for comparison. Read Pen data only through Pencil.

**Test seam:** No application behaviour changes. No app tests or build are warranted. Pencil node inspection and rendered screenshots provide verification.

**After both steps:**

- Run `Get("S3IzNG", visitor, {resolveInstances:true, resolveVariables:true})`. Expect 223 nodes, with all original 117 text nodes retaining their IDs and content.
- Check `ctx.problems` only when every ancestor has `enabled !== false`. Expect zero visible clipping findings.
- Confirm only the specified colours, `IpXYd` layout/text positions and added poster changed.
- Confirm frame dimensions, 342px column, 48px navigation, 40px bottom bar, season selector, ten episode rows, two versions and two history entries retain their geometry.
- Confirm the copied poster is 48×72 at `(20,22)` with the original fill. Confirm `N2Ft37` remains unchanged.
- Confirm no replaced warm or dark surface colours remain in `S3IzNG`. White text must appear only on the three dark controls: `FNnbY`, `I2gmK`, `WdrG5`.
- Compare outside-target node properties. Report concurrent changes without reverting them.
- Inspect `TakeScreenshot(["S3IzNG","PLCJY","lXfHm"])` for poster visibility, glyph fit, overlap, complete content and clear selection. Allow one batched correction pass and one confirmation pass.
- Calculate actual text/background contrast, requiring at least 4.5:1. Proposed limiting pairs were checked during scoping: secondary text/inactive season button 5.08:1; teal selection text 5.22:1; white/teal 6.10:1; risk text/pale red 6.01:1; green/main surface 5.30:1.
- Repeat `git status --short`; report additional tracked changes.

Deliver final images and verification report under:

`/Users/alechenderson/.codex/visualizations/2026/10/08/01a11b00-0d07-7e12-853e-a237c063f0df/light-episode-details`

Use Pencil export for image delivery. Report static visual verification separately from runtime behaviour, and identify the restored poster as the original placeholder.

### Execution plan

- **One serial design track:** steps 1–2. Own only `S3IzNG` and its descendants within `design/mediaManager2.pen`, plus verification artifacts. Model `gpt-6.1-sol`; effort `medium`. This supported Sol model can perform the bounded colour and geometry edits while preserving the shared dirty document.
- **Starting state:** existing `codex-design-finish` worktree and currently open document, including all uncommitted design work. Do not create another checkout. Only one agent may edit this canvas at a time.
- **Track checks:** the executor runs every verification above and provides actual tool output.
- **Independent review:** `gpt-6-astra`, effort `high`, read-only after execution. Review scope, poster restoration, unchanged content, contrast and rendered results.
- **Repairs:** `gpt-6.1-sol`, effort `medium`, same ownership, using concrete reviewer findings. The bounded repair scope requires the same document-preservation care.
- **Combined verification:** after execution and any repairs, the orchestrator repeats the node, content, geometry, contrast and visual checks, then performs the native save.

### Executor rules (copy verbatim into the handoff prompt)

> - Follow the steps in order. Do not add, merge, reorder, or skip steps.
> - Before editing in any folder, read the nearest AGENTS.md above it (and the root one) if the repo has them — folder rules and traps bind even when the work order doesn't repeat them.
> - If reality contradicts a Verified fact or a step is impossible as written, STOP and report the discrepancy. Do not improvise a workaround.
> - Before reporting progress, audit each claim against a tool result from this session. Only report work you can point to evidence for. If tests fail, say so with the output.
> - If the work order names a new test, run it before making the change and paste the failing output. A test that passes before the change proves nothing.
> - Completion requires the checks assigned to your track to pass. Report exact commands, working directory, exit status, and relevant output. The orchestrator verifies the combined result.
> - Touch nothing in the Out-of-scope list. Other agents may be working; preserve their edits and existing user changes. Do not commit or push.
> - Deliver what was asked, at the scope intended. If the spec seems mistaken or a better approach exists, say so in a sentence and continue as specified rather than quietly narrowing, widening, or transforming it.

