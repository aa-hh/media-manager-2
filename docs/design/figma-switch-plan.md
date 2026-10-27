# Switching design work from pen.dev to Figma

Written 27 Oct 2026. The plan for moving this app's design work into Figma and linking Figma to Storybook.

## Decisions

The owner made these on 27 Oct 2026:

- Figma replaces pen.dev for this app. The `.pen` files in `~/Projects/media-manager-2-design/` stay as read-only reference, and no new work goes into them.
- New designs start in Figma. Once a component is built, the code (`src/client/components/ui/` and `src/client/globals.css`) is the master copy, and the Figma library gets refreshed from the code after each build.
- Most screens are already built. The owner will rebuild the missing ones in Figma, starting from the code.
- Story tests join `sh scripts/test.sh --full` and CI, and accessibility violations fail the run.
- `/library-review`, the `library-reviewer` agent and the `pen-refresh` and `pen-library-changes` scripts get retired.
- The global `~/.claude/CLAUDE.md` gets a "Working in Figma" section for this app. The "Working in .pen files" section stays for other projects.

## How a design moves from idea to code

1. **Explore in Figma.** Each screen file has `README`, `FINAL` and `DISCOVERY` frames, the same as the pen.dev rules. Explorations use instances from the Figma library and never change the library itself.
2. **Approve.** Only the owner's words start a build, as with `/approve-design` today.
3. **Build.** Any new or changed component gets built in code first, along with its story and a link to its Figma component. The screen is then put together from those components.
4. **Check.** `sh scripts/build.sh` and `sh scripts/test.sh` pass, and Storybook's tests and accessibility checks pass for every story that changed.
5. **Refresh Figma from the code.** After the pull request merges, the changed components get redrawn in the Figma library so it matches what shipped.

A fix made directly in code, like PR #219's toast and selection-bar fixes, skips steps 1 and 2 but still ends with step 5.

## Limits that shape the plan

- **No Code Connect.** It needs a Figma Organization or Enterprise plan, and the owner's plan is Professional. Each component links to Figma in two places instead: its story (`parameters.design`, which the Storybook designs addon reads) and the header comment at the top of its file.
- **Figma read calls are capped** at 200 a day and 10 a minute for a Full seat on Professional (Figma's [rate limits page](https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/)). Calls that write to Figma don't count. Checking a component after drawing it takes about two reads (`get_metadata` and `get_screenshot`), so drawing all 88 components takes three to four days of calls.
- **Only one Figma writer at a time.** The Figma library skill (`figma:figma-generate-library`) forbids running two `use_figma` calls at once, so the library can't be split across parallel agents.
- **Stories aren't tested anywhere automatic.** `vite.config.ts` sets up a Storybook test project, but `scripts/test.sh` and CI (`.github/workflows/tests.yml`) only run `tests/production.test.mjs`. Accessibility checks are set to `todo` in `.storybook/preview.tsx`, so violations show up but nothing fails.

## Work

Tracks A, B and C can run at the same time because they touch different files.

### Track A: build the Figma library from the code

One Opus agent at a time, following the `figma:figma-use` and `figma:figma-generate-library` skills, in the owner's Professional team.

1. Create the library file `media-manager-2 library` with a `README` page, a `Foundations` page, and one page per component family. Families come from the `v2/Family/Variant` names in the component header comments.
2. Create variables from the `:root` block of `src/client/globals.css` (226 custom properties): colours, radii, spacing and type. Set each variable's web code syntax to `var(--name)`, using the same name as the CSS. Motion values and the reduced-motion block stay code-only, because Figma variables can't drive animation.
3. **Owner checkpoint:** the owner reviews the Foundations page before any component is drawn.
4. Draw the components in order, small pieces first (button, badge, checkbox, chips, marks), then rows, then bars, dialogs and panels. Each component's variant properties match its React props, one variant for each story that is a prop combination. Stories that only show a state (an open dialog, for example) become example frames beside the component.
5. **Owner checkpoint** after the first five components, before the rest.
6. After drawing each component, compare its Figma screenshot with its Storybook story, then:
   - replace the pen.dev line in the component's header comment with the Figma component's name and URL;
   - add `parameters: { design: { type: 'figma', url } }` to the `meta` in its `.stories.tsx` file. Check this format against the addon in the first story before applying it to the rest.
7. Publish the file as a team library.

Done when all 88 story files show their Figma component in Storybook's Design panel, and no file under `src/` mentions `design-system.lib.pen`. Three files outside `components/ui/` also carry pen.dev references and get Figma links the same way: `src/client/settings/Settings.tsx`, `src/client/title/AddControls.tsx` and `src/client/globals.css`.

### Track B: rewrite the rules and docs

One Opus agent, no Figma calls.

- `.claude/skills/approve-design/SKILL.md`: rewrite for the five steps above. It keeps the rule that only the owner's words start it. It reads the approved frame with `get_design_context`, builds in code first, and ends with step 5.
- `design/README.md`: link the Figma library and screen files, and state the rules (explorations in screen files' `DISCOVERY` frames; the library changes only through `/approve-design`). Mark the `.pen` table as read-only history.
- `DESIGN.md`: lines 4, 173, 175, 177, 238 and 249 describe pen.dev as the source of truth. Point them at the code, with Figma as the copy kept in step. Line 249 describes a pen.dev limit that no longer applies.
- `CLAUDE.md` line 59 and `AGENTS.md` line 57: say Figma instead of pen.dev.

Done when `grep -rn 'pen\.dev\|design-system\.lib' CLAUDE.md AGENTS.md DESIGN.md design/README.md .claude/skills` finds only the read-only history note.

### Track C: make story tests part of the checks

One Opus agent.

- add the Storybook test project to `sh scripts/test.sh --full`;
- install Playwright's Chromium in the CI job;
- set `a11y.test` to `'error'` in `.storybook/preview.tsx`, and fix or record any violations that surface.

### After the tracks

- The main session updates the pen.dev memories in `~/.claude/projects/-Users-alechenderson-Projects-media-manager-2/memory/`: deletes the ones about pen.dev's own bugs and rewrites the ones about design rules (explorations in screen files, design before UI code, extend library components first) for Figma.
- The main session deletes `/library-review` (`~/.claude/skills/library-review/`), the `library-reviewer` agent (`~/.claude/agents/library-reviewer.md`) and `~/.claude/scripts/pen-refresh` and `pen-library-changes`.
- The main session drafts the "Working in Figma" section of `~/.claude/CLAUDE.md`. It goes in only after the owner approves the wording.
- The owner rebuilds missing screens in Figma, using instances from the library.
