### Goal

Create editable, desktop-only Discover designs in `/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/codex-design-finish/design/discovery.pen`. The owner should be able to judge browsing rows, filtered grids, streaming-service selection, and failure states before application implementation. Preserve the existing light design system. The user chose “Create the designs first,” excluded phone designs, and explicitly waived the reviewer agent.

### Verified facts

- The target worktree is on `1aac296d8a6737e7c8e4ff91d95429c9730a6ccd`. Initial status contains modified `design/design-system.lib.pen`, `design/releases.pen`, `design/settings.pen`, and `design/title.pen`; untracked `.scratch/light-mode-episode-details/`, `design/discovery.pen`, `design/generated.png`, and `design/setup-wizard.pen`. Verified with `git status --short` and `git rev-parse HEAD`.
- The newer source checkout is `/Users/alechenderson/.codex/worktrees/2a18/media-manager-2`, initially clean at `9ff56a0cb847ba182c4dff62fa40d494ed65f9f9`. Use its source facts below; do not implement there.
- Both checkouts have a root `AGENTS.md` and no nested `AGENTS.md` found by `rg --files -g AGENTS.md`. Visual layout and copy normally use visual checks rather than unit tests: `AGENTS.md:97`.
- Screen documents import the shared library; copying canvas content between documents loses component links. Pen saves to disk on Cmd+S, and an unopened `filePath` can target the foreground document instead: target worktree `design/README.md:23`.
- The target has no top-level nodes and exposes linked components under alias `b:`. Personally verified with `get_app_state` and `execute/Get`. Encrypted design files have node identifiers rather than usable source-line citations:
  - `b:F5qou`, `v2/AppBar/Desktop`: 1440 × 64, 40-pixel horizontal padding, search, navigation and settings controls.
  - `b:pLro9`, `v2/Header/page`: 26-pixel heading, optional breadcrumb, summary and action.
  - `b:Z0OVp`, `v2/Library poster card`: 152 × 228 poster; title, metadata and optional badge.
  - Poster descendants: `b:Useiw` image area, `b:B9wRy` title, `b:aUm15` metadata, `b:cEGE4` status.
- The linked variables resolve to white backgrounds, black actions, Schibsted Grotesk interface text, Barlow Semi Condensed data text, 40-pixel page margins and 20-pixel poster gaps. These match target `DESIGN.md:5`, `DESIGN.md:44`, `DESIGN.md:59`. Lime is reserved for best releases and live downloads: `DESIGN.md:112`.
- The existing poster component supports an image, metadata and status. Hover darkens the poster; keyboard focus outlines it: newer checkout `src/client/components/ui/library-poster-card.tsx:6`, `:22`, `:35`.
- Discover results carry title, year, media type, poster, rating and library identifier: newer checkout `src/server/discover.ts:9`. Results mark ownership without filtering owned titles out: `:107`.
- The current server supports movie and TV lists, weekly mixed trending, genres, providers, US default region, year range and minimum rating. Trending currently accepts only page; list sorts are popular, rating, newest and upcoming: newer checkout `src/server/discover.ts:21`, `:54`, `:61`, `:145`, `:166`. Mixed filtered grids, additional sort directions and blended Trakt results must therefore be described as proposed design behavior.
- [AA-91](https://linear.app/aa-hh/issue/AA-91/discover-screen-with-rows), personally read, specifies Trending, Popular movies, Popular TV, Upcoming movies, Upcoming TV, followed by selected service rows; Show more; title navigation; and an unconfigured state pointing to settings.
- [AA-92](https://linear.app/aa-hh/issue/AA-92/discover-grids-with-filters-in-the-page-address), personally read, specifies multiple genres/providers, region, year range, minimum rating, sorting, filters in the page address, and more results on scroll. User instructions supersede its phone requirement.
- The latest conversation direction combines Trakt charts with TMDB weekly trending. Numerical weights and a 90-day upcoming horizon remain proposals. Do not display either as settled policy.
- TMDB requires an approved logo and the notice below; JustWatch credit is required for its availability data. Checked against the [TMDB FAQ](https://developer.themoviedb.org/docs/faq) and [watch-provider documentation](https://developer.themoviedb.org/reference/tv-series-watch-providers).
- The current [Trakt API Use Policy](https://developer.trakt.tv/docs/api-use-policy), personally read on 11 October 2026, permits public discovery and proportionate feature caching/background updates. It prohibits bulk catalog mirroring, redistribution, access evasion, and unauthorized protected-account access. Branding requires approved unmodified assets, clear space and no implied endorsement. It forbids use in apps promoting infringement or piracy. Registration grants neither content rights nor a compliance guarantee. The linked branding page failed to load through the web tool; use a plain linked Trakt credit, without a logo, for this design. Do not imply personal watch-history access or a verified live connection. Keep these implementation limits in design notes, outside product UI.
- Pen’s native app identifier is `dev.pencil.desktop`. Native Save still requires the exact requested window. MCP targeting is separate: in the bounded retry inspection, while discovery remained foreground, `execute(filePath=settings.pen)` successfully read Settings node `iXMYJ`. The same node was absent when `filePath=discovery.pen`; that file successfully resolved `b:F5qou`. Thus a foreground change alone does not block MCP edits to an open document. An unopened-file fallback remains a documented trap in `design/README.md:26`.
- The first execution attempt failed at `Insert(appbar+'/b:f6yp9', ...)`. The tool rolled back the whole snippet; no design nodes survived. The exact input and error are saved in `.scratch/discover-design/failed-step1.txt`. Failed `editId` is `YJ66g`, with no patches applied. Fresh `get_app_state` showed discovery empty during retry inspection.
- Pen’s current `guide/components.md` instructs using `Replace(instanceId+'/childId', completeObjectTree)` for replacement inside an instance and `Insert` only into an ordinary frame. `execute.md` requires repairing a failed call with its `editId` and `edits`, never resending the snippet. I personally reread these instructions and the failed input. Replacing this app-bar subtree is documented but remains to be proved by the executor’s actual edit; scoping made no design mutation.

### Steps

Complete these edits in the requested document, in order. Pass the full requested `filePath` on every MCP call. Before each mutation, verify the document inside that same execute snippet: read `b:F5qou` and require its ID, name `v2/AppBar/Desktop` and width 1440 to match; after the first successful call, also read the returned local home-frame ID and require `Discover — Desktop`. Abort before any mutation on a mismatch or missing node. This check protects against the documented fallback if the target closes. A different foreground document is not a reason to pause, change windows or ask the owner to stop. Use `get_app_state` for orientation, not as a requirement that the target remain foreground. Native save/reopen still requires verifying the exact window. Report a real targeting failure with its evidence; do not loop on foreground checks or invent a shared lock.

Preparation does not count as a design edit:

- Read the root `AGENTS.md`, `design/README.md`, the Impeccable skill, and Pen’s `pen-schema.md`, `execute.md`, and component guidance.
- Impeccable context already ran once, successfully, in the target worktree with `--target design/discovery.pen`; **do not rerun it**. It loaded `PRODUCT.md` and `DESIGN.md`, reported `platform: web`, `hasVisualImplementation: true`, and `surfaceBriefPath: null`. It requested a manual detector after editing and a relevant surface-brief read.
- The archived `design/mediaManager2.pen` surface brief was read once. Its dark/purple design is stale against current `DESIGN.md` and the inspected white-and-black library. Preserve the current library. The old product text excluding TMDB is superseded by the Discover decision. Do not repair those documents.
- Use Impeccable’s **Operate** mode and established-world extension guidance. The user has already settled the artifact, desktop scope and design direction; do not start an identity-selection exercise.
- Immediately before editing, read `/Users/alechenderson/.agents/skills/impeccable/reference/craft-floor.md`.
- Record initial file metadata and Git status. Keep proof and exports under `/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/codex-design-finish/.scratch/discover-design-from-codex-2a18/`.
- This is the single permitted retry cycle. Start with the empty document left by the rolled-back first call. Receive the first executor’s asset inventory and reuse its verified posters, logo and provenance notes; do not redo completed asset preparation. Recheck the document-local identity and current protected-file metadata. Another session may have saved Settings after the initial baseline; record that change without reverting or attributing it to this task.
- Repair `YJ66g` through `execute` with `editId` and exact `edits`, using `.scratch/discover-design/failed-step1.txt` as the unpatched input. Patch the navigation segment described in step 1 and prepend the document identity check to the same call. Do not resend the input, reuse rolled-back node IDs such as `qxeKn`, or create a second home frame. If the tool cannot find that failed edit across agents, report the exact error to the orchestrator and stop; do not invent a reset or retry method.

1. **Create `Discover — Desktop` in `discovery.pen`.**  
   Make a 1440-pixel-wide, full-content-height frame with the shared app bar, Discover active after Library, global search retained, and the page heading “Discover.” Override only this document’s app-bar instance; preserve the other destinations. Repair the failed navigation segment by replacing `appbar + '/b:f6yp9'` with a complete ordinary horizontal Navigation frame, preserving gap 2 and centered alignment. Populate the replacement tree with the five existing linked `b:ACA2W` item instances in their existing order and a sixth linked Discover item immediately after Library. Read the source navigation from `b:F5qou`; omit generated node IDs from newly created objects, while retaining the descendant override keys. Explicitly make Library inactive in this replacement and Discover selected; retain Calendar, Downloads, Flagged and Health labels and existing count/status overrides. Preserve the surrounding app-bar product name, search and icon controls. Replace the whole navigation subtree in one operation; do not `Insert` or `Move` into an imported descendant and do not change its `children` through `Update`. Once the repaired call succeeds, inspect the expanded app-bar instance to prove six linked items in the required order before continuing. Use the existing 40-pixel margins. Show the five fixed rows in their specified order and one illustrative streaming-service row. Each row has eight poster cards, its heading, sideways-navigation controls and “Show more.” Include a quiet “Streaming services” selection control with “United States” nearby. Do not add a hero banner, recommendation quiz, personalized rows or scoring controls.

2. **Complete the cards and footer inside `Discover — Desktop`.**  
   Reuse the linked poster component, overriding images, title, year/media type, rating and “In library” status. Show both movies and TV in Trending; keep owned titles visible. No duplicate `(type, tmdbId)` within a row; repetition across rows is allowed. Use real poster artwork from accessible existing assets or verified image URLs; retain its origin in node context. Never generate imitation movie posters or ratings presented as live facts. Upcoming examples must not imply already-released titles are upcoming. Omit unavailable ratings rather than showing zero. Use a neutral missing-poster example in the later states frame. Add a restrained footer with an approved TMDB logo, “This product uses the TMDB API but is not endorsed or certified by TMDB.” and JustWatch credit. Use a plain “Trakt” source credit linked to https://trakt.tv; do not fabricate its logo or claim a verified connection.

3. **Create `Discover — Movies, filtered`.**  
   Make a 1440-pixel-wide desktop grid with breadcrumb back to Discover, a clear Movies/TV selector, filters for genre, streaming service, region, year range and minimum rating, plus sort and direction controls. Show one coherent example filter selection as removable chips and a “Clear filters” action. Use eight cards per row and at least two complete rows. At the bottom, show the incremental-loading treatment. Keep controls in the page, without a permanent sidebar. In node context, specify that filter changes replace stale results, reset pagination, and update the page address; Back restores the previous selection.

4. **Create `Discover — TV, filtered`.**  
   Copy the completed grid within this document and adapt the heading, selected media type, titles and genre selection to TV. Preserve the same controls and card dimensions. Do not invent a separate TV layout. Document the same address and pagination behavior. Sorting may display the ticket’s popularity, premiere date, rating and title options with direction; note that some options need future server work.

5. **Create `Discover — Trending, all titles`.**  
   Copy the grid structure and show the expanded mixed Trending row with movie and TV cards. Preserve “Trending” as its source and provide All/Movies/TV selection. The initial view retains the mixed source rather than silently becoming Popular movies. Put the proposed mixed-grid filtering and blended-source requirements in node context; they are not claims about working application behavior. Do not show ranking weights, a fixed upcoming horizon, or personal watch-history controls.

6. **Create `Discover — Streaming services open`.**  
   Copy the relevant home viewport and show the selection control open as a desktop popover or dialog using existing library components. Include provider search, multi-selection, region set to United States, and clear Save/Cancel actions. One familiar provider may be preselected solely as illustrative data. State in node context that the actual provider choices and order belong to the owner. Show one row per selected service; do not silently impose subscription-only availability or split each service into additional movie/TV rows.

7. **Create `Discover — Filters open`.**  
   Copy the relevant Movies grid viewport and expose the multi-select genre/provider controls and the year/rating inputs sufficiently to review labels, selection states and clearing. Show sort choices without simultaneous overlapping menus. Preserve selections when a menu closes. Record that keyboard focus, Escape and reopening must work in future implementation; static frames do not prove those behaviors.

8. **Create `Discover — Loading, empty and unavailable` and `Discover — Design notes`.**  
   The first is one compact desktop state board with clearly separated, labelled examples:
   - Initial loading with poster skeletons and stable row headings.
   - One failed row with “Couldn’t load these titles” and “Try again,” while another row remains usable.
   - Source failure with available results retained and a quiet retry message.
   - Filtered empty results: “No titles match these filters” and “Clear filters.”
   - Unconfigured Discover: one message and “Open connection settings,” without a page of empty rows or credential fields.
   - Missing poster, unavailable rating, long title, “In library,” hover and keyboard-focus card examples.

   The separate notes frame must identify all title/rating/provider fixtures as illustrative, list the intended destinations of cards and Show more, and state the future behavior: open the existing title overview, show stored data immediately, fetch missing details on pointer hover/focus, preserve row source/filter context, and deduplicate by media type plus TMDB identifier. Record unresolved ranking/provider policy as proposals, outside product UI. Add the Trakt policy limits from Verified facts to these design notes. Frame browsing and personal-library management accurately; do not invent content ownership or lawful-access claims, or add piracy-promoting copy. Do not build title-page or settings screens.

### Out of scope — do not touch

- Phone, tablet, dark-mode or responsive implementation.
- Every source, test, configuration, credential and deployment file.
- `design/design-system.lib.pen`, `title.pen`, `settings.pen`, `releases.pen`, `setup-wizard.pen`, `generated.png`, and every other existing design document.
- `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, existing surface briefs and unrelated scratch files.
- Trakt authentication, API testing, key storage, connection setup, account login, scoring implementation or live-result claims. No bulk Trakt catalog export, redistributed data feed, protected-account data or access-restriction workaround.
- New title-page layouts, related-title designs, keyword/subgenre controls, network/studio rows, row editing and watch-history personalization.
- No cleanup, no abstractions, no error handling for impossible cases, no backwards-compat shims.
- No commits, pushes, pull requests, reviewer agents or documenter agents. The owner explicitly waived the reviewer phase.
- Never read, grep or edit `.pen` contents through filesystem tools. File metadata checks are allowed.

### Verification

**Baseline:** The first execution’s complete rollback and the retry inspection both left the requested document empty. `get_app_state` reported the requested document empty. Its linked components and tokens were read successfully. A screenshot of the existing Settings frame confirmed the white-and-black visual system. A read-only layout check on that reference returned `[]`. No source or design edits were made during scoping.

**Test seam:** This changes editable drawings only. There is no runtime behavior for a unit test to prove. Use Pen structure checks, rendered screenshots, saved-file checks and the orchestrator’s independent inspection. Do not run repository builds, remote tests or application tests for this task.

**Executor checks:**

1. From the target worktree, run:
   ```sh
   git rev-parse HEAD
   git status --short
   ```
   Expect the recorded commit and preserved pre-existing changes. Record any concurrent changes without reverting them.

2. Immediately after repairing `YJ66g`, read the returned home frame and `Get(appbarId, {resolveInstances:true})`. Expect exactly one home frame; the app bar must retain its library ref, search and icon controls, with Library, Discover, Calendar, Downloads, Flagged, Health in that order, only Discover selected, and all six navigation items linked to `b:ACA2W`. No tool warnings may remain. Then, after completing each frame, use `Get(frameId, {depth: 1})` and a layout visitor. The following read-only check was exercised successfully during scoping:
   ```js
   Print(Get(frameId, (n,c) => c.problems
     ? {id:n.id,name:n.name,problem:c.problems}
     : undefined));
   ```
   Expect no unexplained clipping, collapsed containers or overflow. All top-level frames must have names, `clip: true`, distinct positions and `placeholder: false` when finished. Cards and controls must retain linked component references. Use `Get(..., {resolveInstances:true, resolveVariables:true})` for inspection when needed.

3. Take one batched screenshot pass covering all nine frames, with detail captures where full-height scaling hides text. Use `TakeScreenshot` on **local screen/frame IDs**; it could not render imported component IDs directly during scoping. Compare type, spacing, borders, card proportions and controls against the existing library. Fix the discovered defects in one batch and confirm at most once. No polishing loop.

4. Run Impeccable’s requested detector once:
   ```sh
   /Users/alechenderson/.agents/skills/impeccable/scripts/impeccable detect --json design/discovery.pen
   ```
   Record its exact output. If it reports no supported input, say so; that is not a visual pass. Do not process encrypted contents yourself or expand scope to make the detector work.

5. Save using CUA: bind `dev.pencil.desktop`, inspect its current accessibility state, verify the requested file’s full path, then use `pressKey("super+s")`. Inspect state again. The “Edited” indicator must disappear. Do not save another foreground document.

6. Record saved metadata:
   ```sh
   stat -f '%N %z %m' design/discovery.pen
   git status --short
   ```
   Expect a non-empty saved file and no task-created changes outside ownership. Reopen **only discovery.pen** through Pen’s native Open action, verify its exact active path, and reread the nine frame names/IDs plus one rendered screenshot. Do not close or discard another document’s edits. Persistence is proven by that reopened content, not a changed timestamp alone.

7. Export all nine frames with:
   ```js
   Export(frameIds, "png",
     "/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/codex-design-finish/.scratch/discover-design-from-codex-2a18/exports",
     {scale:1});
   ```
   Report the mapping of names to IDs and exported paths, the captured checks, saved-file evidence and unresolved defects. Assets downloaded for the design may live only under `.scratch/discover-design/assets/`; preserve working image references when reopening.

**Combined verification by the orchestrator:** independently reread the active document, frame inventory, component bindings and layout results; inspect every exported state and fresh primary-screen screenshots; confirm saved/reopened persistence and compare protected-file metadata with the initial record. Investigate unrelated changes rather than assuming they were made by this executor. Completion requires every required frame and state above. Also verify the plain Trakt source credit, illustrative-data note, and absence of account-access, endorsement or content-rights claims. Report “Reviewer skipped at your request,” not “Astra-reviewed.”

### Execution plan

One fresh serial executor performs the single retry cycle, repairing step 1 and then completing steps 1–8. The original nine desktop frames and all acceptance checks remain required.

- **Model:** `gpt-6.1-sol` (Sol 6.1), explicitly required by the owner. These linked-component designs require demanding visual integration and careful handling of the shared editor.
- **Effort:** `high`.
- **Role:** `work-order-executor`, acting as the requested design expert and following Impeccable.
- **Owned file:** the exact requested `design/discovery.pen`.
- **Permitted supporting files:** `.scratch/discover-design/work-order.md`, verification notes, exports and sourced assets beneath `.scratch/discover-design/` in the newer chat checkout.
- **Starting state:** target worktree commit and dirty-file inventory above. Recheck before editing. No fresh worktree: the requested document depends on the target worktree’s uncommitted library.
- **Dependencies:** Exact-file MCP calls plus a document-local identity check precede each mutation. Multiple open files and unrelated foreground changes are supported. Only native Save/reopen needs the requested window foreground. Do not request another pause merely because another file is active. Stop and report only a failed identity check, missing target or actual conflicting changes inside discovery.pen.
- **Repair scope and reason:** `gpt-6.1-sol`, `high`, owns the same design file and permitted supporting files. The repair requires instance-subtree replacement and reliable file targeting; the rest is the original demanding design track. Do not count asset preparation as unfinished when its recorded checks already passed.
- **Track check:** all executor verification above.
- **After execution:** the orchestrator performs combined verification. No reviewer agent, per explicit user instruction. If a repair is required, return the concrete failure to the scoper for a bounded repair assignment; preserve completed frames and unrelated work.

### Executor rules (copy verbatim into the handoff prompt)

> - Follow the steps in order. Do not add, merge, reorder, or skip steps.
> - Before editing in any folder, read the nearest AGENTS.md above it (and the root one) if the repo has them — folder rules and traps bind even when the work order doesn't repeat them.
> - If reality contradicts a Verified fact or a step is impossible as written, STOP and report the discrepancy. Do not improvise a workaround.
> - Before reporting progress, audit each claim against a tool result from this session. Only report work you can point to evidence for. If tests fail, say so with the output.
> - If the work order names a new test, run it before making the change and paste the failing output. A test that passes before the change proves nothing.
> - Completion requires the checks assigned to your track to pass. Report exact commands, working directory, exit status, and relevant output. The orchestrator verifies the combined result.
> - Touch nothing in the Out-of-scope list. Other agents may be working; preserve their edits and existing user changes. Do not commit or push.
> - Deliver what was asked, at the scope intended. If the spec seems mistaken or a better approach exists, say so in a sentence and continue as specified rather than quietly narrowing, widening, or transforming it.
