# Design files

Designs live in Figma, in the owner's Figma team. This folder keeps the logos and the sign-in shader page, which the code and the README use.

Light mode, desktop first. Once a component is built, the code (`src/client/components/ui/` and `src/client/globals.css`) is the master copy, and the Figma library is a copy kept in step with it.

- **Library:** the Figma file `media-manager-2 library` holds the variables (the same names as the CSS custom properties in `globals.css`) and every `v2/Family/Variant` component.
- **Screen files:** one Figma file per place in the app, built from instances of the library. Phone versions of a screen go in the same file as its desktop version.

## Rules

- Every screen file has three top-level frames: `README`, `FINAL` (the version of each screen the code is built from) and `DISCOVERY` (explorations).
- Explorations go in `DISCOVERY` of the screen's own file and never change the library. A component an exploration needs that the library lacks is drawn inside the exploration.
- The library changes only through `/approve-design` (`.claude/skills/approve-design/`): once the owner approves a design, it is built in code first, and the library is redrawn from the code after the pull request merges.

## Old pen.dev files

Before 27 Oct 2026 the designs were `.pen` files in `~/Projects/media-manager-2-design/`, outside git, with the library in `design-system.lib.pen`. They are read-only history: open them to look up an old decision, and make no new work in them. `archive/mediaManager2-2026-10-11.pen` in that folder holds the dark screens.
