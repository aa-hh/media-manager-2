# Flaky: TitlePlay `StillResume` story fails its accessibility check

Quarantined 31 Oct 2026 with `tags: ['!test']` in `src/client/title/TitlePlay.stories.tsx`.

## What fails

The Storybook test run (`storybook (chromium)` in the `tests` workflow) fails the story's after-play accessibility check:

> ARIA hidden element must not be focusable or contain focusable elements (aria-hidden-focus)

on two `span[data-base-ui-focus-guard][aria-hidden="true"][tabindex="0"]` elements: the focus guards Base UI puts around the open resume menu.

## Where it was seen

- PR #265 (Cut what each Play waits on, and quiet mpv), run 41190103407, 31 Oct 2026 09:48.
- PR #266 (Cache and gzip built files…), run 41190836715, 31 Oct 2026 09:59.
- Neither PR changed `TitlePlay.stories.tsx` or the menu; the same story passed on PR #266's first commit (run 41188960247).

## Likely cause

The play function clicks "Play from the start", which closes the menu. Whether the guards are still in the page when the check runs depends on how fast the menu's close finishes, so the result changes run to run.

## Done when

The story passes its accessibility check on repeated runs (for example by waiting in the play function until the menu is gone, or by passing the menu's own option that drops the guards), and the `'!test'` tag is removed.
