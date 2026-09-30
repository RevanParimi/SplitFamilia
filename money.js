// Balance maths for the ledger, in whole paise. Pure functions: no DOM, no network, no module
// state, so `npm test` can check them.
//
// An expense's `amount` is read as a decimal number of rupees and becomes integer paise with
// toPaise(). The server keeps whole paise; the page passes them in as amountPaise / 100, which
// toPaise() turns back into exactly the same paise (outbox.js forBalances; npm test checks).

// The largest amount one expense can have: ₹1,00,00,000.00. ledger-rules.js, which the server
// checks every expense with, must allow the same maximum (npm test checks).
export const MAX_AMOUNT_PAISE = 1000000000;

// A stored amount in paise, or null when it is not a number in (0, maximum].
// For example 0.30000000000000004 → 30, and 1e308, Infinity, NaN or "300" → null.
export function toPaise(amount){
  if(typeof amount !== "number") return null;
  if(!(amount > 0) || !(amount <= MAX_AMOUNT_PAISE / 100)) return null;
  return Math.round(amount * 100);
}

// Why an expense is left out of the balances: "amount", "payer" or "split", or null when it
// counts. A left-out expense still shows in the ledger, flagged, so someone can delete it.
export function expenseProblem(exp){
  if(toPaise(exp.amount) === null) return "amount";
  if(typeof exp.paidBy !== "string" || exp.paidBy === "") return "payer";
  if(!Array.isArray(exp.split) || exp.split.length === 0) return "split";
  const allIds = exp.split.every(function(id){ return typeof id === "string" && id !== ""; });
  return allIds ? null : "split";
}

// Splits whole paise among person IDs: [{ id, paise }], sorted by ID.
// Everyone gets floor(total / n); the r leftover paise go one each to the first r IDs in sorted
// order, so every phone gives the extra paisa to the same person whatever the split's order.
// Sorting compares UTF-16 code units, never the phone's locale.
export function splitShares(totalPaise, ids){
  const sorted = ids.slice().sort();
  const base = Math.floor(totalPaise / sorted.length);
  const leftover = totalPaise - base * sorted.length;
  return sorted.map(function(id, i){
    return { id: id, paise: base + (i < leftover ? 1 : 0) };
  });
}

function addTo(balances, id, paise){
  balances.set(id, (balances.get(id) || 0) + paise);
}

// people: [{ id }], expenses: [{ amount, paidBy, split: [personId] }]
// Returns a Map of personId → balance in paise; positive means the group owes that person.
// The balances always sum to exactly 0. A payer or split member who is no longer in `people`
// (possible when two phones edit at once) keeps their balance under their old ID, so no money
// vanishes. A Map, not an object, so IDs such as "constructor" or "__proto__" are plain keys.
export function computeBalances(people, expenses){
  const balances = new Map();
  people.forEach(function(p){ balances.set(p.id, 0); });
  expenses.forEach(function(exp){
    if(expenseProblem(exp) !== null) return;
    const total = toPaise(exp.amount);
    addTo(balances, exp.paidBy, total);
    splitShares(total, exp.split).forEach(function(share){
      addTo(balances, share.id, -share.paise);
    });
  });
  return balances;
}

function byAmountThenId(a, b){
  if(a.amt !== b.amt) return b.amt - a.amt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Turns a Map of balances in paise into a short list of payments: [{ from, to, amount }], with
// amount in paise. Largest debtor pays largest creditor first; ties go by ID. Applying the
// payments brings every balance to exactly 0. Values that are not whole paise are ignored,
// so the loop always ends: every step pays off at least one person in full.
export function simplifyDebts(balances){
  const creditors = [];
  const debtors = [];
  balances.forEach(function(v, id){
    if(!Number.isSafeInteger(v)) return;
    if(v > 0) creditors.push({ id: id, amt: v });
    else if(v < 0) debtors.push({ id: id, amt: -v });
  });
  creditors.sort(byAmountThenId);
  debtors.sort(byAmountThenId);
  const txns = [];
  let i = 0, j = 0;
  while(i < debtors.length && j < creditors.length){
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    txns.push({ from: debtors[i].id, to: creditors[j].id, amount: pay });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if(debtors[i].amt === 0) i++;
    if(creditors[j].amt === 0) j++;
  }
  return txns;
}

// Paise as a number with two decimals, grouped for the locale: 3334 → "33.34",
// 1000000000 in "en-IN" → "1,00,00,000.00". Leave `locale` out to use the phone's.
export function formatPaise(paise, locale){
  return (paise / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Reads the add-expense form's amount text. Returns { paise } or { error } with a message
// for the person typing. Works on the text, not a float, so "0.29" is exactly 29 paise.
export function parseAmountInput(text, locale){
  const raw = String(text).trim();
  if(raw === "") return { error: "Enter an amount." };
  if(/^-/.test(raw)) return { error: "Enter an amount greater than 0." };
  const m = /^(\d*)(?:\.(\d*))?$/.exec(raw);
  if(!m || (m[1] === "" && !m[2])) return { error: "Enter a number, like 250 or 99.50." };
  const whole = m[1].replace(/^0+/, "");
  const fraction = m[2] || "";
  if(fraction.length > 2) return { error: "Use at most 2 decimal places." };
  const tooLarge = { error: "The largest amount allowed is " + formatPaise(MAX_AMOUNT_PAISE, locale) + "." };
  if(whole.length > 15) return tooLarge;
  const paise = Number(whole || "0") * 100 + Number((fraction + "00").slice(0, 2));
  if(paise === 0) return { error: "Enter an amount greater than 0." };
  if(paise > MAX_AMOUNT_PAISE) return tooLarge;
  return { paise: paise };
}
