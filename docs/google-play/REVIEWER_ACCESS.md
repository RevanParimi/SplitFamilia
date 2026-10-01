# App access: instructions for Google Play's reviewers

For Play Console → App content → **App access** (Play may call it **Sign-in details**; VERIFY IN
PLAY CONSOLE). Story SF-016 (task T-05). The answers behind it are in
[PLAY_CONSOLE_DECLARATIONS.md](PLAY_CONSOLE_DECLARATIONS.md), section 3.

**Select:** "All functionality in my app is available without any access restrictions."

SplitFamilia has **no accounts, no sign-in and no passwords**, so there are no credentials to
give and no username or password placeholders to fill in. Everything can be tried from a fresh
install, with an internet connection.

**MANUAL ACTION REQUIRED:** if Play Console offers a field for instructions, paste the text
below.

## Text to paste

> SplitFamilia needs no login. To try every main feature:
>
> 1. Open the app and tap **Start a new group**. Type a name such as "Goa trip" and tap
>    **Start group**.
> 2. The guide says "Who's sharing costs?". Tap **Add people**. Under **Add a person**, type
>    "Asha" and tap **Add**. Do the same for "Ben" and "Chitra". Close the sheet with the ×.
> 3. The guide says "Add the first expense". Tap **Add expense**. Under "What was it for?" type
>    "Dinner", under **Amount** type 300, choose **Paid by** Asha, and leave it split equally among
>    everyone. Tap **Add expense**.
> 4. **Balances** now shows that Ben owes Asha ₹100 and Chitra owes Asha ₹100.
> 5. Tap "Dinner" under **Expenses**, tap **Delete**, then **Delete** again to confirm. The
>    balances return to "All settled up."
> 6. Optional: add the expense again, then tap a line under **Balances** and **Record payment**.
>    This only records a payment made outside the app; SplitFamilia never moves money.
>
> The group menu (the round button at the top, or tap the group's name) has the people list,
> the currency symbol and **Copy invite link**, which shares the group with others. The data is
> kept on the app's own server.

The path in steps 1 to 3 is the one T-04's browser check clicks through (B12–B13 in
`docs/planning/evidence/T-04-browser-check.mjs`); the labels were checked against `index.html`
in T-05.

## A pre-filled demo group (optional)

**OWNER CONFIRMATION REQUIRED:** whether to give reviewers a ready-made group. If you do:

1. **MANUAL ACTION REQUIRED:** make a new group with made-up names and a few expenses, and copy
   its invite link from the group menu.
2. Add to the text above: "A demo group with sample data: `<PLAY_REVIEWER_GROUP_LINK>`", with
   the real link in place of the placeholder.

The link opens that group for anyone who has it, so it goes **only into Play Console, never
into git** or any file in this repository. Use a group made only for this, never a family group.
