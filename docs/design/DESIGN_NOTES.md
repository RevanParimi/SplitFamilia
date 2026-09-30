# SplitFamilia design notes (v2)

Friendly and simple: a white background, one rounded sans for headings, one brand colour (indigo) and one warm accent (saffron), and a colour for each person. Each screen has one obvious main action, and everything else is one tap away. Light theme only.

## Principles

- **One main action per screen.** On Welcome it's Start a new group or Join with a link. On the group home it's Add expense. In a sheet it's the one filled button in the footer.
- **The group home shows only** the group name, the sync dot, the people avatars, the balances, the expenses and the Add expense button.
- **The group menu** opens when you tap the group name or ⋯. It holds the invite link, currency, Switch group and People.
- **Tap the thing itself.** Tap a balance to record a payment. Tap an expense to edit or delete it. Tap the avatars to manage people.
- **New groups are guided.** A single card walks through: 1 Add people → 2 Add the first expense → 3 Invite your group. It replaces the balances until the group has 2+ people and an expense.
- **Sync stays quiet.** There is a small white dot when live, which pulses while connecting. Words appear only when they matter.

## Colour tokens

Contrast ratios are against `--bg` (#FFFFFF) unless noted.

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--bg` | `#FFFFFF` | page, sheets, cards | — |
| `--surface` | `#F6F5F2` | hover, quiet fills, secondary button | — |
| `--line` | `#E7E4DE` | dividers, card borders | decorative |
| `--line-strong` | `#8E877D` | input borders | 3.6:1 (non-text) |
| `--ink` | `#1C1A18` | text | 17:1 |
| `--ink-soft` | `#56514B` | secondary text | 7.8:1 |
| `--ink-faint` | `#6E6860` | hints, placeholders, counters | 5.3:1 |
| `--brand` | `#4F46E5` | header band, main buttons, focus ring | white on it 6.3:1 |
| `--brand-press` | `#4038C9` | hover/pressed brand | white 7.6:1 |
| `--brand-soft` | `#ECEBFE` | “Change” button, group tiles, menu icons | brand text on it 5.5:1 |
| `--accent` | `#F4A51C` | saffron: guide progress, logo dot, feature graphic | decorative only, never text |
| `--accent-soft` | `#FFF3D9` | guide card background | — |
| `--accent-ink` | `#8A5300` | text on accent-soft | 5.8:1 |
| `--good` | `#157347` | settled, payments, “gets back” | 5.9:1 (5.2:1 on good-soft) |
| `--good-soft` | `#E5F4EB` | settled card, payment summary | — |
| `--owe` | `#C0392B` | owes, errors, delete | 5.4:1 (4.8:1 on owe-soft) |
| `--owe-soft` | `#FDECE9` | error boxes, message bar | — |

Meaning never relies on colour alone: every balance, status and error is also written out in words.

### Person colours

Assigned in the order people are added, reused after six. Each is a tint (background) and an ink (initial). Each initial passes 5.5:1 on its tint.

| # | Tint | Ink |
|---|---|---|
| 1 | `#FFE3D8` | `#9C3514` |
| 2 | `#D6F1EA` | `#0B5E55` |
| 3 | `#E3E1FF` | `#4133B8` |
| 4 | `#FFEDC2` | `#7F5200` |
| 5 | `#FBDDEB` | `#9B1C57` |
| 6 | `#DAEAFE` | `#1E4FB8` |

Avatars are `aria-hidden`, and the name is always written next to them. The removed-person fallback is `#ECEAE6` / `#56514B` with “?”.

## Type tokens

Two families from Google Fonts: **Plus Jakarta Sans** (600/700/800) and **Inter** (400/500/600/700).

| Role | Font | Size / line-height | Weight |
|---|---|---|---|
| Wordmark | Jakarta | 30 / 1.1, −0.02em | 800 |
| Group name (header) | Jakarta | 26 / 1.2, −0.015em | 800 |
| Sheet title | Jakarta | 22 / 1.25 | 800 |
| Guide card title | Jakarta | 21 / 1.25 | 800 |
| Section heading | Jakarta | 18 | 800 |
| Amount input | Jakarta | 26, tabular-nums, right-aligned | 800 |
| Body, rows, inputs | Inter | 16 / 1.5 | 400–600 |
| Buttons | Inter | 15–17 | 700 |
| Labels | Inter | 14 | 600 |
| List amounts | Inter | 15–16, tabular-nums, right-aligned | 700 |
| Meta, hints | Inter | 13 / 1.4 (minimum size) | 400 |

- Amounts use `font-variant-numeric: tabular-nums`, `white-space: nowrap` and en-IN grouping (₹1,00,00,000.00).
- Names and descriptions use `overflow-wrap: anywhere` and wrap cleanly.
- Inputs are 16px so mobile browsers don't zoom.

## Spacing

The base unit is 4px: `4 · 8 · 12 · 16 · 20 · 24 · 32`.

- Page gutter: `max(20px, env(safe-area-inset-left/right))`.
- Header top padding: `env(safe-area-inset-top) + 8px`. Bottom bars and sheet footers pad by `env(safe-area-inset-bottom) + 14px`.
- Space between sections is 24–28. Space between fields is 16–18. List rows have 12 vertical padding.
- Content max width is 640px on phones. From 700px wide, the home uses two columns (balances left, expenses right, max width 1040) and sheets become centred 560px panels.
- Tap targets are at least 44 × 44. Main buttons are 56px tall.

## Corner radius

| Radius | Use |
|---|---|
| 8 | progress dashes, swatches |
| 12 | small buttons (Change, Remove, dismiss) |
| 14 | inputs, group tiles, guide button, list-row hover |
| 16–18 | main buttons, message bar, menu rows |
| 20–22 | cards (balances, settled, guide, empty welcome) |
| 24 | sheet top corners, dialogs |
| 50% / 999 | avatars, icon circles, status pill |

## Components

### Buttons
- **Primary**: `--brand` fill, white 16–17/700 text, 56px, radius 16–18. One per screen: Add expense, Start a new group, Start group, Join, Save, Record payment.
- **Secondary**: 1.5px `--brand` outline, brand text. Used for “Join with a link”.
- **Soft**: `--brand-soft` fill, brand text, 44px, radius 12. Used for “Change” / “Done” on the split line.
- **Guide button**: `--ink` fill, white text, 48px, radius 14.
- **Destructive**: 1.5px `--owe` outline for Delete in sheets. The `--owe` fill is used only for the confirm button in a dialog.
- **Text buttons** (Edit, Remove, Not now) keep a 44px hit area.
- **Focus**: every control gets a 3px `--brand` outline with a 2px offset (`:focus-visible`).

### Header (group home)
- Brand-coloured band.
- **Row 1**: the group name with a chevron, which is the button that opens the group menu. Then the sync dot, then a 44px round ⋯ button (white at 16%).
- **Row 2** (only when there's something to say): the sync pill.
- **Row 3**: overlapping 36px avatars with a 2px brand ring (up to 5, then “+N”), then a 44px dashed “+” (Add a person) and the text “4 people”.

### Sync indicator
| State | Shows |
|---|---|
| live | white dot with a soft halo; screen readers hear “Sync status: live” |
| connecting… | the same dot, pulsing |
| 3 changes waiting to sync | white 18% pill with text |
| offline: changes will sync when you're back online | white 18% pill, hollow dot |
| offline: 3 changes waiting to sync | white 18% pill, hollow dot |
| not syncing | `--owe-soft` pill with `--owe` text and dot |

### Avatar
A round tint with a Jakarta 800 initial. Sizes: 30 in the form, 36 in the header and balances, 40 in expense rows and the people sheet, 52 in the payment summary. A payment row's avatar gets a 20px green arrow badge.

### Rows
- **Balance row** (64px): payer avatar, then “**Ben** owes **Asha**”, then the amount in `--owe`, then a chevron. The whole row opens Record payment. A caption above the list reads “Tap one to record a payment”.
- **Expense row** (68px): payer avatar, then the description (16/600) with meta below (“29 Sep · paid by Asha · split among 3”; the year is added when it isn't this year), then the amount (right). The whole row opens Edit.
- **Payment row**: avatar with the arrow badge, then “Ben paid Asha” in `--good`, meta “28 Sep · payment”, and a green amount.
- **Unsynced**: a grey `--surface` pill with a clock and “waiting to sync”, and the amount in `--ink-faint`.
- **Group row** (72px): a 44px brand-soft tile with the group's initial, the name, “Opened 2 minutes ago” and a chevron. In Edit mode, the chevron becomes a red-outline “Remove from this device” button.
- **Menu row** (64px): a 44px icon circle, a 16/600 label and a 13px hint below.

### Cards
- **Balances**: 1px `--line` border, radius 20, rows divided by `--line`.
- **All settled up**: `--good-soft`, a 48px green circle with a smile, “All settled up.” (Jakarta 20/800, green) and “Nobody owes anybody.”
- **Guide**: `--accent-soft`, radius 22. It holds “Step N of 3”, three 22×5 progress dashes (saffron for done and current), a title, one sentence and one button. Step 3 also offers “Not now”.

### Bottom sheet
- One shell for everything: scrim `rgba(28,26,24,.42)`, `--bg` panel, 24px top corners, a 40×5 handle, a Jakarta 22 title, a round 44px close, a scrolling body, and a footer pinned above the safe area. Tap the scrim to close.
- The sheets are Group menu, People, Start a new group, Join with a link, Add/Edit expense, and Record/Edit payment.
- **Add expense**: “What was it for?” (up to 200 characters, with a counter) and “Amount” are the only typed fields.
  - The “Paid by” line starts on whoever paid the most recent expense, and uses a native select.
  - The “Split equally among everyone · Change” line opens the checkbox list (Everyone, then one row per person with their avatar).
  - A split error opens the list automatically. A share hint below reads “₹400.00 each”.
- **Record payment**: a green-soft summary (from avatar → “paid” → to avatar), then Amount prefilled with the full debt and the note “That's everything Ben owes. Change it for a part payment.”, then the line “This only records a payment made outside the app. SplitFamilia never moves money.”
- **People**: one row per person (avatar, name, Remove). A blocked removal shows the message inline under that row. Below the list is “Add a person” (up to 60 characters) with an Add button.

### Dialogs
A centred `alertdialog` (radius 24, max 380). The title names the item, e.g. “Delete ‘Dinner’ (₹1,200.00)?” or “Remove Chitra from the group?”. One sentence follows, then Cancel (surface) and the destructive action (owe fill) on the right.

### Field errors
Errors appear in `--owe`, 14px, with an alert icon, directly under the field. The field gets an `--owe` border, `aria-invalid` and `aria-describedby`. There are never pop-up alerts.

### Message bar
One message at a time. `--owe-soft` fill, 1px `--owe` border, radius 16, `role="alert"`, a 44px dismiss. It floats 12px from the sides, above the Add expense bar (or above the bottom safe area on Welcome).

### Start-up
The logo mark (an indigo rounded square with a saffron dot) and the wordmark.
- **Loading**: a 120×4 progress track and “Loading…”.
- **Failure**: a wifi-off icon, “Can't reach SplitFamilia. Check your connection.” and a Retry button.

## App texts kept word for word

- **Sync:** “live”, “connecting…”, “3 changes waiting to sync”, “offline: changes will sync when you're back online”, “offline: 3 changes waiting to sync”, “not syncing”.
- **Start-up:** “Can't reach SplitFamilia. Check your connection.”
- **Join:** “That group link isn't valid.”
- **Balances:** “All settled up.”
- **People:** “Can't remove someone who appears in an expense. Delete their expenses first.”
- **Expense form:** “Add a description.”, “Enter an amount.”, “Enter a number, like 250 or 99.50.”, “Pick at least one person to split with.”, “Add at least one person first.”
- **Messages:** “Couldn't save that expense. Can't reach the server right now. Check your connection and try again.”, “This group can't be opened. Check the invite link.”
- **From the app's code** (`money.js`, `index.html`): “Give the group a name.”, “Paste an invite link or code.”, “Use at most 2 decimal places.”, “Enter an amount greater than 0.”, “The largest amount allowed is ₹1,00,00,000.00.”

## Where everything moved

- Copy invite link, Currency and Switch group are in the group menu. Copy invite link is also step 3 of the guide.
- Adding and removing people happens in the People sheet (tap the avatars, or +).
- Record payment: tap a balance. Edit or delete: tap an expense.
- Remove from this device: tap “Edit” next to Your groups.
- The join paste field is in the “Join with a link” sheet.
