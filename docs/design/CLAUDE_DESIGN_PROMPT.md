# Prompt for Claude Design — SplitFamilia UI (for SF-028, T-04)

Given to Claude Design by the owner on 2026-09-29. The result is a **design reference** for
SF-028: save its HTML export and screenshots in this folder (`docs/design/`). The T-04 session
ports the look into `index.html` and keeps every behaviour; the export never replaces
`index.html`, because it has none of the app's Firebase, offline or sync wiring.

---

Design a polished, mobile-first UI for **SplitFamilia**, "a running ledger for shared costs":
families and friends split the costs of any trip or shared occasion. Deliver it as a clickable
HTML prototype of every screen and state below.

## The app

- A group can be any trip or occasion: a holiday, a wedding, a Diwali party, a weekend away.
  Its people log each expense (who paid, split equally among whom) and see who owes whom,
  simplified to the fewest payments. Nothing in the design should assume a particular trip or
  place.
- Mainly Indian users: default currency ₹, Indian number format (₹1,00,000.00). The group can
  set any currency symbol of up to 3 characters.
- It runs on Android phones as an installed app (full screen, no browser bar) and in any mobile
  browser. Design for phones first; it must also look fine on a tablet.
- There is no sign-in. A group is a private code (e.g. `goa-trip-7k2m9xqpwd`) shared as an
  invite link; anyone with the link can see and edit the group. Changes sync live between
  phones and work offline.

## Style

Keep the existing calm "paper and ink" identity. Polish it; don't replace it. Solid and
finished, not flashy: it should look good in Play Store screenshots. Light theme only.

- Colours (CSS custom properties, keep the names): `--paper #F6F4EF`, `--paper-raise #EFEBE1`,
  `--ink #211F1D`, `--ink-soft #5B564D`, `--ink-faint #8A8375`, `--green #2F5D50`,
  `--green-soft #E4ECE7`, `--rust #8C3B2E`, `--rust-soft #F3E4DF`, `--line #DCD6C9`,
  `--line-strong #B9B0A0`. Green means "gets back / all good", rust means "owes / delete".
  You may adjust shades for contrast.
- Type: Source Serif 4 (headings), Inter (interface), IBM Plex Mono (amounts and group codes).
  Amounts are right-aligned with tabular figures.

## Screens and states

Sample data for the mock-ups only: people Asha, Ben, Chitra, Dev; groups "Goa trip", "Diwali
party 2026" and "Ooty weekend" in "Your groups".

1. **Start-up:** a quiet loading state, and a failure state: "Can't reach SplitFamilia. Check
   your connection." with a Retry button.
2. **Welcome / join:**
   - "Your groups": recent groups on this device, most recent first, each with its last-opened
     time, one tap to open, and "Remove from this device" (which never deletes the group
     itself). An empty state for first-time users.
   - "Start a new group" (a group name).
   - "Join with a link or code" (paste field) with a "Checking…" state and the error "That group
     link isn't valid."
3. **Group home**, in this order:
   - Header: group name, "Copy invite link", "Switch group", the currency symbol setting, and a
     small sync status. Its exact states: "live", "connecting…", "3 changes waiting to sync",
     "offline: changes will sync when you're back online", "offline: 3 changes waiting to
     sync", "not syncing".
   - **Balances first:** each line reads like "Ben owes Asha ₹450.00", with a "Record payment"
     action. When everything is even: "All settled up."
   - **People:** names as chips or a list, add a person (up to 60 characters), remove a person.
     Someone who appears in an expense can't be removed; show "Can't remove someone who appears
     in an expense. Delete their expenses first." inline, not as a pop-up.
   - **Add expense:** reached from one clear button (a bottom sheet or a collapsible card):
     description (up to 200 characters), amount (up to ₹1,00,00,000.00), paid by, and "split
     equally among" with a checkbox per person and "everyone". Errors show inline next to the
     field, never as pop-up alerts: "Add a description.", "Enter an amount.", "Enter a number,
     like 250 or 99.50.", "Pick at least one person to split with.", "Add at least one person
     first."
   - **Ledger:** newest first. Each row shows the date (with the year when it isn't this year),
     description, amount, "paid by Asha · split among 3". A settle-up row looks different:
     "Ben paid Asha ₹100.00". A row not yet saved to the server shows "waiting to sync". Tap a
     row to edit it.
4. **Edit expense:** the same fields filled in, Save, and Delete.
5. **Record payment (settle-up):** "Ben paid Asha", the amount filled in with the full debt and
   editable for a part payment, and a short line saying the app only records a payment made
   outside the app; it never moves money.
6. **Confirmations:** "Delete 'Dinner' (₹1,200.00)?" and "Remove Chitra from the group?", each
   naming the item.
7. **Message bar** for errors, e.g. "Couldn't save that expense. Can't reach the server right
   now. Check your connection and try again." and "This group can't be opened. Check the invite
   link."

## Constraints (it must be implementable in the existing app)

- One static HTML file: inline CSS, and only a little plain JavaScript for the prototype's
  interactions. No React, Tailwind, icon fonts, build step or other libraries; no external
  files except the three Google Fonts above. Simple inline SVG icons are fine.
- Every tap target at least 44 × 44 px (including remove and delete buttons). Respect
  `env(safe-area-inset-*)`. No horizontal scrolling at 360 px wide. Check 360, 390 and 412 px,
  and a tablet width.
- WCAG AA contrast for text, visible focus states, and a real `<label>` for every input.
- Long names and descriptions wrap cleanly; nothing overflows.
- The quoted status, error and message texts are the app's own: keep them word for word. The
  quoted button and section labels ("Your groups", "Record payment", "split among 3") are
  suggestions you may improve.
- Don't add features that aren't listed: no sign-in, profiles, payments, receipts or photos,
  notifications, charts, export, reminders or unequal splits.

## Deliverables

1. The HTML prototype with every screen and state above (a screen switcher is fine).
2. Short design notes: the colour and type tokens, spacing and corner-radius scale, and each
   component (chips, buttons, sheets, rows, dialogs, the status indicator).
3. The six screens to use as Play Store phone screenshots, at 9:16 (1080 × 1920): welcome with
   your groups, people, adding an expense, the ledger, the balances, and "All settled up".
4. Optional: a Play Store feature graphic, 1024 × 500 px, with no transparency.

---

## Follow-up prompt 2 (2026-09-29): more colour, fewer options

The owner liked the first prototype but found it too close to a generic "Claude" look and too
busy for a first-time user. Sent in the same Claude Design conversation:

Thanks, this is close. Two changes. Keep the layout and components mostly as they are.

**1. A friendlier, more colourful look (not a big change).** The cream paper, serif headings and
muted ink feel like a generic "Claude" style. Make it feel like its own warm, friendly app:

- A clean white or very light background instead of cream.
- A friendly sans-serif for headings (for example Plus Jakarta Sans or Nunito from Google
  Fonts) instead of the serif; at most two font families. Amounts keep tabular figures.
- One main brand colour and one warm accent, used with restraint (main buttons, the header,
  highlights): colourful but calm, never neon.
- Give each person a colour: a round avatar with their initial, from a small set of matching
  colours, shown wherever the name appears (people, balances, expense rows).
- Keep the meaning colours: green for "gets back / settled", a warm red or coral for "owes" and
  "delete".
- Show 3 palette options side by side on the group home (for example teal with coral, indigo
  with saffron, green with mango) so I can pick one. Each must meet WCAG AA for text.

**2. Much simpler to use: fewer options on screen.** Someone opening the app for the first time
should understand it in a few seconds without exploring.

- Each screen has one obvious main action. Everything else is one tap away, not on screen.
- The group home shows only: the group name, a small sync indicator, the balance summary, the
  list of expenses, and one big "Add expense" button at the bottom.
- "Copy invite link", "Currency", "Switch group" and managing people move into one group menu
  (the group name or a "⋯" opens a sheet). While the group has one person or no expenses, show a
  friendly "Invite your group" prompt instead.
- People: a compact row of avatars with a "+" to add. Removing someone happens in the people
  sheet, not with an × on every chip.
- Balances: plain sentences ("Ben owes Asha ₹450.00"); tapping a row records a payment, instead
  of a link on every row. When even: "All settled up." with a friendly icon.
- The sync status stays quiet when live (a small dot) and shows words only when it matters
  ("offline: …", "3 changes waiting to sync", "not syncing").
- Add expense: only the description and the amount need typing. "Paid by" starts on whoever
  paid the most recent expense, and "Split equally among everyone" is one line with "Change",
  which opens the checkboxes.
- Welcome: your groups (if any) and two big buttons, "Start a new group" and "Join with a
  link". The paste field appears only after tapping Join.
- A new group guides you one step at a time: add people → add the first expense → invite
  others. Each empty state says what to do next, with one button.
- Plain words: "Expenses" instead of "Ledger".

Everything the app does must still be reachable, with the same status and error texts, just not
all on screen at once. Don't add features. Please update the prototype, the design notes and the
six screenshots.
