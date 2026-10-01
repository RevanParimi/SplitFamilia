# Store graphics (SF-015)

What Google Play asks for, what this repo already has, and what's missing. The listing's texts
are in [STORE_LISTING.md](../STORE_LISTING.md).

**Source:** Play Console Help, [Add preview assets to showcase your
app](https://support.google.com/googleplay/android-developer/answer/9866151), checked on
2026-10-01 (IST). Play changes these rules from time to time: **VERIFY IN PLAY CONSOLE** when
uploading (the upload form states its own limits).

## Requirements, and what fits

| Asset | Play's requirement (2026-10-01) | In this repo | Fits? |
|---|---|---|---|
| App icon | 512 × 512 px, 32-bit PNG (with alpha), at most 1,024 KB; must follow Play's icon design specifications; no badges or misleading text | `icon-512.png` (repo root): 512 × 512, 8-bit RGBA (32-bit), 265,424 bytes, every pixel opaque, a full square (Play rounds the corners itself) | **Yes.** Made from the owner's own image (D-19, 2026-10-01) |
| Feature graphic | 1,024 × 500 px, JPEG or 24-bit PNG (no alpha) | `feature-graphic-1024x500.png` (this folder): 1,024 × 500, 24-bit RGB, no alpha | **Yes.** A copy of the design's `docs/design/playstore-mockups/feature-graphic-1024x500.png`, which is RGBA (not accepted); all its pixels were opaque, so the copy is identical, pixel for pixel |
| Phone screenshots | 2 to 8; JPEG or 24-bit PNG (no alpha); each side 320–3,840 px, the long side at most twice the short side. For Play's recommendations: at least 4, at least 1,080 px, 9:16 portrait or 16:9 landscape. No device frames or added marketing text | `phone-screenshots/01-…07-*.png`: 7 shots, 1,080 × 1,920 (9:16), 24-bit RGB, no alpha, 113–179 KB each | **Yes**, including the recommendation rule (7 ≥ 4, 1,080 px, 9:16) |
| 7-inch tablet screenshots | Optional. Up to 8; at least 4 for recommendations; 1,080–7,680 px, 9:16 or 16:9 | None | **Missing (optional)** |
| 10-inch tablet screenshots | Optional. As for 7-inch | None | **Missing (optional)** |

## Where each file came from

- **Phone screenshots:** `docs/planning/evidence/T-04-store-shots.mjs` runs the real app on a
  local server with a temporary database and made-up groups and people (Asha, Ben, Chitra, Dev),
  in headless Edge at 360 × 640 CSS px and 3× = 1,080 × 1,920, as inside the Android app (no
  "Install app" button). Re-run it after a UI change:
  `node docs/planning/evidence/T-04-store-shots.mjs . <empty scratch folder> docs/google-play/assets/phone-screenshots`.
  The dates in the shots are relative to the day it runs.
- **Feature graphic:** `python docs/planning/evidence/T-04-flatten-png.py
  docs/design/playstore-mockups/feature-graphic-1024x500.png
  docs/google-play/assets/feature-graphic-1024x500.png 4F46E5` (standard library only). Its
  words, "SplitFamilia", "a running ledger for shared costs", two balances and "All settled up.",
  are all things the app shows.
- **Icon:** the owner's image, `docs/design/icon/splitfamilia-icon.png` (1,254 × 1,254, a
  rounded square on white), made into `icon-512.png`, `icon-192.png` and `apple-touch-icon.png`
  at the repo root by `node docs/planning/evidence/T-04-make-icons.mjs . <empty scratch folder>`.
  The script fills the white corners with the background and adds an 8% margin, so neither Play's
  rounded mask nor Android's circle shows white or cuts the "S". The same files serve the
  manifest, the iPhone home screen and, later, the Android app. To change the icon, replace the
  source image and run the script again.

The six `docs/design/playstore-mockups/0*.png` files are design mock-ups, not the app: don't
upload them.

## What's missing

1. **Tablet screenshots (optional).** The page has a two-column tablet layout from 700 px wide;
   the store-shots script can take them at a tablet size if the owner wants them.

**MANUAL ACTION REQUIRED:** upload the icon, the feature graphic and the phone screenshots in
Play Console → Grow users → Store presence → Main store listing → Graphics.
