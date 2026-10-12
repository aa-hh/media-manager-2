---
name: approve-design
description: Bring DESIGN.md and the code component library in line with the pen.dev library once the owner approves a design. Use when the owner says a design is approved, signed off or final, or types /approve-design. Never on an agent's own judgement that a design is done.
---

# Approve design

The owner has approved a design. Changes to `~/Projects/media-manager-2-design/design-system.lib.pen` (components or variables added, changed or deleted) now go into the code, as the very next job, without stopping in between. The session the owner approved in runs this, whether the design was drawn by that session or by one of its subagents.

Iterating on a design is not approval. Only the owner's words start this.

## Steps

1. **Library saved?** Ask the owner to confirm they pressed Cmd+S in the library tab; pen.dev writes to disk only then.
2. **Worktree.** Work in a worktree branched from `origin/main`, as `CLAUDE.md` describes. Never in the main checkout.
3. **Read the library** through pen.dev's tools (`mcp__pencil__*`; check `get_app_state` shows the library open first): every `v2/Family/Variant` component with its id, and every variable.
4. **Compare it with the code and the docs:**
   - components: `src/client/components/ui/*.tsx`, each headed `// v2/Family/Variant — ~/Projects/media-manager-2-design/design-system.lib.pen <id>`
   - variables: `src/client/globals.css` and the front matter of `DESIGN.md`
   - component notes: the component sections of `DESIGN.md`
5. **Apply every difference:**
   - added: write the component in `src/client/components/ui/`, with the header comment.
   - changed: update the component file and every variable it uses.
   - deleted: delete the component file. If a screen still uses it, stop and ask the owner what replaces it.
   - update `DESIGN.md` to match: front matter values and the component sections.
6. **Check:** `sh scripts/build.sh` and `sh scripts/test.sh` pass.
7. **Finish** as `CLAUDE.md` says: push, `gh pr create --fill`, `bash scripts/review-branch.sh`, then ask the owner before merging.

Report which components and variables were added, changed and deleted.

## Handing it to a subagent

Pass this file's steps in full, with `model: "opus"`. If that subagent starts its own subagents, it must start them with `run_in_background: false`.
