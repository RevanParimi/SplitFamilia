# SplitFamilia design (Claude Design, v2, indigo-saffron)

The owner's approved UI design for SF-028 (T-04), made in Claude Design on 2026-09-29/30 and
exported on 2026-09-30. It is a reference for building the real app, not app code: nothing here
is shipped (the `Dockerfile` copies only the app's files).

| Path | What it is |
|---|---|
| `DESIGN_NOTES.md` | **The spec:** colour and type tokens, spacing, radius, every component, and where each feature moved. Start here. |
| `prototype/SplitFamilia-Prototype-v2.html` | The clickable prototype with every screen and state; open it in a browser and use its `screen` switcher. It is a Claude Design bundle running React 18, packed in the file. Look at it; never copy its code into the app. |
| `playstore-mockups/` | Six 1080 × 1920 mock-up screens and a 1024 × 500 feature graphic (all PNG with transparency). The store's screenshots must show the real app; see SF-015. |
| `source/` | Claude Design's editable project files (`.dc.html` and `support.js`). They only work inside Claude Design; kept so the design can be reopened or rebuilt there. |
| `icon/splitfamilia-icon.png` | The owner's app icon (D-19, 2026-10-01): the source of `icon-512.png`, `icon-192.png` and `apple-touch-icon.png`, made by `docs/planning/evidence/T-04-make-icons.mjs`. |
| `CLAUDE_DESIGN_PROMPT.md` | The prompts that produced it (prompt 1, then follow-up 2: more colour, fewer options). |

Left out of the export on purpose: Claude Design's `uploads/` (a screenshot of the owner's
screen) and `.thumbnail`.

Watch for: the prototype's sample invite links use `splitfamilia.app`, which is not the app's
address. The real one is `https://splitfamilia.up.railway.app`.

**Built (T-04, SF-028, 2026-10-01 IST):** `index.html` now follows this design. Where the app
differs from it (for example the sync pill's tint, for contrast), the T-04 implementation receipt
lists each difference and why.
