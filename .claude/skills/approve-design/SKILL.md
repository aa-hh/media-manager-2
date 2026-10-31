---
name: approve-design
description: Build an approved Figma design in code, then redraw the changed components in the Figma library once it merges. Use when the owner says a design is approved, signed off or final, or types /approve-design. Never on an agent's own judgement that a design is done.
---

# Approve design

A design moves from idea to code in five steps (`docs/design/figma-switch-plan.md`):

1. **Explore in Figma.** Explorations sit in the `DISCOVERY` frame of the screen's Figma file and use instances from the `media-manager-2 library` file. They never change the library.
2. **Approve.** Only the owner's words start this skill. Iterating on a design is not approval.
3. **Build** in code: each new or changed component first, with its story and its Figma link, then the screen from those components.
4. **Check.** The build, the tests and the stories' accessibility checks pass.
5. **Refresh Figma from the code.** After the pull request merges, redraw the changed components in the library so it matches what shipped.

This skill runs steps 3 to 5. The code (`src/client/components/ui/`, `src/client/globals.css`, and for the TV app `android-tv/`) is the master copy; the Figma library is a copy kept in step with it. The session the owner approved in runs this, whether that session or one of its subagents drew the design.

## TV path

A design for the Google TV app (the Kotlin and Compose code in `android-tv/`) follows the same steps, with these differences. Each step below says where.

- **Start:** TV components are instances of the published `TV Design Kit` Figma library (file `Rsy65KLjApSI4falPy3Ea9`), restyled to our theme. The TV screens file is `LOntH5HQXfvTnfapJoyoqZ`.
- **Library name:** `v2/TV/<Family>/<Variant>`, in the same `media-manager-2 library` file.
- **Code:** `android-tv/app/src/main/java/io/github/aahh/mediamanager2/tv/ui/components/`.

## Steps

1. **Worktree.** Work in a worktree branched from `origin/main`, as `CLAUDE.md` describes. Never in the main checkout.
2. **Read the approved frame.** Get its Figma URL from the owner if the conversation lacks it. Load the `figma:figma-use` skill, then call `get_design_context` on the frame, plus `get_screenshot` for a picture to compare against. Figma allows 200 read calls a day, so read the frame once and work from what came back.
3. **List the differences** between the frame and the code:
   - components: every `v2/Family/Variant` the frame adds, changes or stops using, against `src/client/components/ui/*.tsx` (TV: the `v2/TV/…` components, against the `.kt` files in the TV components folder)
   - variables: against `src/client/globals.css` and the front matter of `DESIGN.md` (TV: the theme in `android-tv/`)
   - component notes: against the component sections of `DESIGN.md` (TV: its TV section)
4. **Build each component first:**
   - added: write it in `src/client/components/ui/`, headed `// v2/Family/Variant — <Figma URL>`, with a `.stories.tsx` file whose `meta` has `parameters: { design: { type: 'figma', url } }`. Until step 8, the URL points at the component in the approved exploration. TV: write it in the TV components folder, headed `// v2/TV/<Family>/<Variant> — <Figma URL>`, with a Compose `@Preview` instead of a story.
   - changed: update the component file, its story and every variable it uses.
   - deleted: delete the component file and its story. If a screen still uses it, stop and ask the owner what replaces it.
   - update `DESIGN.md` to match: front matter values and the component sections. TV: it gains a TV section.
5. **Build the screen** from those components.
6. **Check:** `sh scripts/build.sh` and `sh scripts/test.sh` pass, and Storybook's tests and accessibility checks pass for every story that changed. TV: `sh scripts/android-tv.sh build` and `sh scripts/android-tv.sh test` pass instead; there are no stories.
7. **Finish** as `CLAUDE.md` says: push, `gh pr create --fill`, `bash scripts/review-branch.sh`, then ask the owner before merging.
8. **After the merge, redraw the library.** Load `figma:figma-use` and `figma:figma-generate-library`, then redraw every added or changed component and variable in `media-manager-2 library` from the merged code (TV: as `v2/TV/<Family>/<Variant>`; the Kotlin code is the master copy), and remove the deleted ones. One agent writes to Figma at a time. Compare each redrawn component's screenshot with its story. If a new component's links still point at the exploration, open a small pull request that moves its header comment and story `url` to the library component.

Report which components and variables were added, changed and deleted, and whether step 8 is done.

## Handing it to a subagent

Pass this file's steps in full, with `model: "opus"`. If that subagent starts its own subagents, it must start them with `run_in_background: false`.
