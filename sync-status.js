// What the page tells people about syncing and errors (SF-009, SF-035). Pure functions: no DOM
// and no network, so `npm test` can check them.

// The server's error codes (server/api.js) in plain words. Nobody sees the server's own text.
const ERROR_TEXT = {
  "not-found": "No group found with that code. Check it, or ask for the invite link.",
  "unavailable": "Can't reach the server right now. Check your connection and try again.",
  "resource-exhausted": "The server is busy right now. Try again in a few minutes.",
  "failed-precondition": "That change doesn't fit the group as it is now. Reload the app and try again.",
  "invalid-argument": "Something in that entry can't be saved. Check it and try again."
};
const DEFAULT_ERROR_TEXT = "Something went wrong. Try again.";

// The numbers here are ledger-rules.js's MAX_PEOPLE and MAX_SPLIT (npm test checks they agree;
// this module imports nothing, so the page loads it with one ?v=). A refused split or payer
// usually means another phone removed that person while this change waited.
const FIELD_TEXT = {
  "in-use": "That person is in an expense now, so they can't be removed. Delete their expenses first.",
  "group-full:person": "This group already has 100 people.",
  "group-full:expense": "This group is full: it can't take more expenses.",
  "group-full:expense-edit": "This group is full: it can't take more expenses.",
  "split": "Someone it's split among isn't in the group any more, or it's split among more than 100 people.",
  "paidBy": "The person who paid isn't in the group any more.",
  "code": "That group link isn't valid.",
  // An edit of an expense another phone deleted or edited first (SF-022).
  "gone": "Someone else changed or deleted it first, so this edit wasn't saved."
};

const own = function(obj, key){ return typeof key === "string" && Object.prototype.hasOwnProperty.call(obj, key); };

// An error code ("not-found"), or an error { code, field } as the server sends it ({ error, field }
// becomes { code, field }), → a message for people. `kind` is what was being saved ("person",
// "expense", …), for a 409 that means "full". Anything unknown gets the default.
export function friendlyError(codeOrError, kind){
  const isObject = codeOrError !== null && typeof codeOrError === "object";
  const code = isObject ? codeOrError.code : codeOrError;
  const field = isObject ? codeOrError.field : undefined;
  if(code === "failed-precondition" || code === "invalid-argument"){
    if(own(FIELD_TEXT, field + ":" + kind)) return FIELD_TEXT[field + ":" + kind];
    if(own(FIELD_TEXT, field)) return FIELD_TEXT[field];
  }
  return own(ERROR_TEXT, code) ? ERROR_TEXT[code] : DEFAULT_ERROR_TEXT;
}

function changes(n){ return n === 1 ? "1 change" : n + " changes"; }

// The group bar's status. `state`:
// - online: the browser's navigator.onLine (kept up to date by its online/offline events);
// - heard: the page has read the group from the server since its live connection opened;
// - fromCache: the live connection isn't up, so the page shows the phone's copy;
// - pending: changes made on this phone that the server hasn't confirmed, deletes included;
// - failed: syncing stopped for good (no such group).
// "live" only when the live connection is up, the server's copy is shown and nothing waits.
export function syncStatusText(state){
  if(state.failed) return "not syncing";
  if(!state.online){
    return state.pending > 0
      ? "offline: " + changes(state.pending) + " waiting to sync"
      : "offline: changes will sync when you're back online";
  }
  if(state.pending > 0) return changes(state.pending) + " waiting to sync";
  if(!state.heard || state.fromCache) return "connecting…";
  return "live";
}
