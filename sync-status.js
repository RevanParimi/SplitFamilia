// What the page tells people about syncing and errors (SF-009). Pure functions: no DOM, no
// Firebase, so `npm test` can check them without the network.

// Firestore error codes in plain words. Nobody sees Firestore's own message text.
const ERROR_TEXT = {
  "permission-denied": "This group can't be opened. Check the invite link.",
  "unavailable": "Can't reach the server right now. Check your connection and try again.",
  "resource-exhausted": "The server is busy right now. Try again in a few minutes.",
  "failed-precondition": "The app is out of date on this device. Reload it and try again.",
  "invalid-argument": "Something in that entry can't be saved. Check it and try again."
};
const DEFAULT_ERROR_TEXT = "Something went wrong. Try again.";

// An error code ("permission-denied", or an error with that `code`) → a message for people.
// Anything unknown, including no code at all, gets the default.
export function friendlyError(codeOrError){
  const code = codeOrError && typeof codeOrError === "object" ? codeOrError.code : codeOrError;
  return typeof code === "string" && Object.prototype.hasOwnProperty.call(ERROR_TEXT, code)
    ? ERROR_TEXT[code]
    : DEFAULT_ERROR_TEXT;
}

// How many changes made on this phone the server hasn't confirmed yet, from a Firestore query
// or document snapshot (only `metadata.hasPendingWrites` and `docs` are read). Each unsaved
// document counts once. A pending delete leaves no document behind, so a snapshot that is
// waiting but shows no waiting document counts as 1: the count is "at least", never too many.
export function countPending(snap){
  if(!snap || !snap.metadata || !snap.metadata.hasPendingWrites) return 0;
  const docs = Array.isArray(snap.docs) ? snap.docs : [];
  const waiting = docs.filter(function(d){ return d.metadata && d.metadata.hasPendingWrites; }).length;
  return Math.max(waiting, 1);
}

function changes(n){ return n === 1 ? "1 change" : n + " changes"; }

// The group bar's status. `state`:
// - online: the browser's navigator.onLine (kept up to date by its online/offline events);
// - heard: every listener has had its first snapshot;
// - fromCache: some snapshot came from this phone's cache, not the server;
// - pending: countPending() summed over the listeners;
// - failed: a listener stopped with an error.
// "live" only when the server itself has confirmed everything on screen.
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
