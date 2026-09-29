// Tests for sync-status.js (SF-009): error codes in plain words, and the group bar's status.
// The expected texts are written out here, not copied from the code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { friendlyError, countPending, syncStatusText } from "../sync-status.js";

// ---------- error messages ----------

test("each Firestore error code the card names gets its own plain message", function(){
  assert.equal(friendlyError("permission-denied"), "This group can't be opened. Check the invite link.");
  assert.equal(friendlyError("unavailable"), "Can't reach the server right now. Check your connection and try again.");
  assert.equal(friendlyError("resource-exhausted"), "The server is busy right now. Try again in a few minutes.");
  assert.equal(friendlyError("failed-precondition"), "The app is out of date on this device. Reload it and try again.");
  assert.equal(friendlyError("invalid-argument"), "Something in that entry can't be saved. Check it and try again.");
});

test("an error object is read by its code, and its own message is never shown", function(){
  const err = { code: "permission-denied", message: "Missing or insufficient permissions. groups/goa-trip-2026" };
  assert.equal(friendlyError(err), "This group can't be opened. Check the invite link.");
  const text = friendlyError({ code: "internal", message: "raw text from Firestore" });
  assert.doesNotMatch(text, /raw text/);
});

test("an unknown, missing or odd code gets the default message", function(){
  const fallback = "Something went wrong. Try again.";
  for(const odd of ["internal", "deadline-exceeded", "", undefined, null, 42, {}, { code: 7 }, "toString", "__proto__", "constructor"]){
    assert.equal(friendlyError(odd), fallback, "for " + String(odd && odd.code !== undefined ? odd.code : odd));
  }
});

// ---------- counting unsaved changes ----------

function snap(hasPendingWrites, docsPending){
  return {
    metadata: { hasPendingWrites: hasPendingWrites, fromCache: false },
    docs: (docsPending || []).map(function(p){ return { metadata: { hasPendingWrites: p } }; })
  };
}

test("countPending counts each unsaved document once", function(){
  assert.equal(countPending(snap(false, [false, false])), 0);
  assert.equal(countPending(snap(true, [true, false, true])), 2);
});

test("a pending delete leaves no document behind but still counts as 1", function(){
  assert.equal(countPending(snap(true, [false, false])), 1);
  assert.equal(countPending(snap(true, [])), 1);
});

test("a document snapshot (no docs list) counts 1 when it is waiting", function(){
  assert.equal(countPending({ metadata: { hasPendingWrites: true } }), 1);
  assert.equal(countPending({ metadata: { hasPendingWrites: false } }), 0);
  assert.equal(countPending(null), 0);
});

// ---------- the status text ----------

const base = { online: true, heard: true, fromCache: false, pending: 0, failed: false };
function status(changes){ return syncStatusText(Object.assign({}, base, changes)); }

test("live only when online, every listener has heard, nothing is from the cache and nothing waits", function(){
  assert.equal(status({}), "live");
});

test("connecting… before the first snapshots, and while data still comes from the phone's cache", function(){
  assert.equal(status({ heard: false }), "connecting…");
  assert.equal(status({ fromCache: true }), "connecting…");
});

test("offline says so, with or without changes waiting", function(){
  assert.equal(status({ online: false }), "offline: changes will sync when you're back online");
  assert.equal(status({ online: false, fromCache: true, heard: false }), "offline: changes will sync when you're back online");
  assert.equal(status({ online: false, pending: 1 }), "offline: 1 change waiting to sync");
  assert.equal(status({ online: false, pending: 3 }), "offline: 3 changes waiting to sync");
});

test("online with unsaved changes counts them", function(){
  assert.equal(status({ pending: 1 }), "1 change waiting to sync");
  assert.equal(status({ pending: 2 }), "2 changes waiting to sync");
  assert.equal(status({ pending: 2, fromCache: true }), "2 changes waiting to sync");
});

test("a stopped listener wins over everything else", function(){
  assert.equal(status({ failed: true }), "not syncing");
  assert.equal(status({ failed: true, online: false, pending: 2 }), "not syncing");
});
