# Card production

This folder contains the approved illustrations, category frames, backgrounds,
text, fonts (with licenses), and layout recipes for all 39 fronts and four backs.
Nothing in the local archive is needed to update or regenerate them.

From the repository root, after `npm ci`:

```sh
npm run cards:render
npm run cards:verify
```

Exports go to ignored `artifacts/card-production/`: each category has trim PNGs
(750 × 1050, 2.5 × 3.5 inches at 300 DPI), bleed PNGs (825 × 1125, including
⅛ inch on each edge), full-size compositions, and a layout manifest. Open
`artifacts/card-production/index.html` for the gallery; print at 100% scale to
paper or PDF for an actual-size proof. Exports use sRGB. Confirm the printer's
bleed, safe area, and color requirements before ordering.

To change a front, edit its category's `cards.json`. `rules` is the printed main
text; `quip` is the centered footer. Replace its matching illustration in
`assets/` to change the art. Preserve transparency and leave room around the
subject. The prepared frame/background files retain the current colors,
corners, target icon, margins, and other approved styling. The renderers name
their exact inputs; `provenance.json` records their historical origins only.

```sh
npm run cards:render -- --group=defense --card=defense-revive
# After reviewing the generated card:
npm run cards:render -- --group=defense --card=defense-revive --install
```

Groups: `weapons`, `defense`, `ability`, `healing`, `events`, `classic-back`,
`backs`. `--card` applies to front-card groups. Without `--install`, the game
images are untouched. Installation saves the first previous image under the
ignored output folder, then replaces the public PNG. `npm run build` regenerates
the game's optimized images. Rule changes also need corresponding updates to
the engine, catalog, and `docs/current-rules.md`; changing printed text alone
does not change gameplay.

`cards:verify` requires a full render and compares decoded pixels against all
43 installed cards, checking trim/bleed dimensions and DPI too. It should pass
after a faithful regeneration or an approved installation. It intentionally
fails when an uninstalled revision differs. Keep `package-lock.json` and the
bundled fonts to reproduce typography; an intentional Sharp/font update may
require reviewing newly rendered pixels. The launcher isolates font discovery
to the bundled files and pins the approved antialiasing/hinting settings, so
desktop font preferences do not change exports. Use the launcher commands above
instead of invoking a category renderer directly. The legacy "Noto Sans Condensed Bold"
label resolves to the bundled Noto Sans Bold used by the approved renders.

Commit changes to this folder and installed game images. Experiments, galleries,
PDFs, intermediate compositions, and past versions belong in ignored
`artifacts/` or `local-archive/`, not Git. A local archive is not a second backup;
copy it to your usual backup storage when needed.

## Publishing a slim repository

Removing files from the current tree does not remove their older Git objects.
To prepare a separate repository for publication while preserving this checkout:

```sh
node scripts/export-slim-repository.mjs local-archive/publish-ready
```

The destination must not exist. The export retains the current branch's code
and document history, omits historical binary artwork, then adds a verified
snapshot of the current working files (including uncommitted cleanup). It
creates a commit in the new repository only. Current game images and production
inputs are included. Other branches, tags, and tool checkpoint refs are not
exported. Historical commit IDs change and old commits need the original
archive for their artwork. A sibling `-report.json` records every exported file
and checksum. No remote is configured and nothing is pushed automatically.

Use the exported checkout as the working repository after publishing it; future
pushes from the original checkout would bring back the old history. Keep the
verified full-history bundle and the local art archive before any cutover.
