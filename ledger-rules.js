// What a group may hold: the ledger's limits and shape checks (SF-033). The server's API refuses
// anything these refuse, and from T-09 the page checks the same before sending. Pure functions
// with no imports, so the page can load this as "./ledger-rules.js?v=N" with nothing else to
// version.
//
// Group codes are checked by isValidGroupId() in group-code.js, which the page and the server
// already share. MAX_AMOUNT_PAISE repeats money.js's (npm test checks they agree), and the page's
// maxlength attributes must match the text limits here (also checked).

export const MAX_AMOUNT_PAISE = 1000000000; // ₹1,00,00,000.00, the same as money.js
export const MAX_CURRENCY_LENGTH = 3;
export const MAX_NAME_LENGTH = 60;
export const MAX_DESC_LENGTH = 200;
// A group holds at most 100 people, big enough for a group trek (the owner, 2026-09-30), so an
// expense is split among at most 100. The caps stop anyone who has the code from filling a group
// with thousands of people or splitting one expense among them.
export const MAX_PEOPLE = 100;
export const MAX_SPLIT = 100;
// A group holds at most 5,000 expenses, deleted ones included (the owner, D-17): far more than a
// family trip needs, and a bound on what anyone can store in one group.
export const MAX_EXPENSES = 5000;
// And at most 20,000 split entries in all, deleted expenses included (the owner, D-18): an expense
// split among 4 people is 4 entries. Room for 100 people × 200 expenses, or 10 × 2,000, while
// keeping a whole group's read to about 5 MB (the T-08 review's F-10 measured 37 MB without it).
export const MAX_SPLIT_ENTRIES = 20000;
export const MAX_ID_LENGTH = 64;

// A person's or an expense's ID: the old 20-character IDs (kept when the data moved) and
// crypto.randomUUID()'s both fit.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
// A time as Date.toISOString() writes it, which is what the page stores: "2026-09-29T06:30:00.000Z".
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export function isValidId(value){
  return typeof value === "string" && ID_PATTERN.test(value);
}

// Text of 1 to `max` UTF-16 units (what an input's maxlength counts, so "😀" is 2), not only
// spaces, and with no broken surrogate pair.
function isText(value, max){
  return typeof value === "string" && value.length >= 1 && value.length <= max
    && value.trim() !== "" && (typeof value.isWellFormed !== "function" || value.isWellFormed());
}

// A real moment: "2026-02-30T…" or "…T24:00:00Z" would roll over to another day, so the date and
// time must come back unchanged.
function isDate(value){
  if(typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const ms = Date.parse(value);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 19) === value.slice(0, 19);
}

function hasExactly(body, keys){
  if(body === null || typeof body !== "object" || Array.isArray(body)) return false;
  const own = Object.keys(body);
  return own.length === keys.length && keys.every(function(k){ return Object.prototype.hasOwnProperty.call(body, k); });
}

function asSet(ids){
  return ids instanceof Set ? ids : new Set(ids);
}

// Each check returns null when the body is fine, or the name of the first thing that isn't:
// "fields" (a missing or extra field), or the field's own name.

// A group: { currency }, e.g. { currency: "₹" }.
export function checkGroup(body){
  if(!hasExactly(body, ["currency"])) return "fields";
  return isText(body.currency, MAX_CURRENCY_LENGTH) ? null : "currency";
}

// A person: { id, name }.
export function checkPerson(body){
  if(!hasExactly(body, ["id", "name"])) return "fields";
  if(!isValidId(body.id)) return "id";
  return isText(body.name, MAX_NAME_LENGTH) ? null : "name";
}

// A settle-up (SF-023) is an expense marked kind: "settlement": the person who paid back is the
// payer, and the one paid is the only person in the split. So "Ben paid Asha ₹100" moves ₹100 of
// Ben's debt to Asha, with the same balance maths as any expense. The app only records a payment
// made outside it; it never moves money.
export const SETTLEMENT = "settlement";
const EXPENSE_KEYS = ["id", "date", "desc", "amountPaise", "paidBy", "split"];

// An expense: { id, date, desc, amountPaise, paidBy, split }, with the amount in whole paise, and
// `kind: "settlement"` for a settle-up (an expense without `kind` is an ordinary one, as all the
// data before SF-023 is). `peopleIds` (a Set or an array) are the group's people: the payer must
// be one of them, and so must each of the 1 to MAX_SPLIT people it is split among, each named
// once. Leave it out to check only the shape.
export function checkExpense(body, peopleIds){
  const withKind = body !== null && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, "kind");
  if(!hasExactly(body, withKind ? EXPENSE_KEYS.concat("kind") : EXPENSE_KEYS)) return "fields";
  if(!isValidId(body.id)) return "id";
  if(!isDate(body.date)) return "date";
  if(!isText(body.desc, MAX_DESC_LENGTH)) return "desc";
  const paise = body.amountPaise;
  if(!Number.isSafeInteger(paise) || paise < 1 || paise > MAX_AMOUNT_PAISE) return "amountPaise";
  if(!isValidId(body.paidBy)) return "paidBy";
  if(withKind && body.kind !== SETTLEMENT) return "kind";
  const split = body.split;
  if(!Array.isArray(split) || split.length < 1 || split.length > MAX_SPLIT) return "split";
  if(!split.every(isValidId) || new Set(split).size !== split.length) return "split";
  // A settle-up is paid to exactly one other person.
  if(withKind && (split.length !== 1 || split[0] === body.paidBy)) return "split";
  if(peopleIds === undefined) return null;
  const people = asSet(peopleIds);
  if(!people.has(body.paidBy)) return "paidBy";
  return split.every(function(id){ return people.has(id); }) ? null : "split";
}
