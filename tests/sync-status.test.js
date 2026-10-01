// Tests for sync-status.js (SF-009, SF-035): the server's error codes in plain words, and the
// group bar's status. The expected texts are written out here, not copied from the code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { friendlyError, syncStatusText } from "../sync-status.js";
import { MAX_PEOPLE, MAX_SPLIT } from "../ledger-rules.js";

// ---------- error messages ----------

test("each error code the server sends gets its own plain message", function(){
  assert.equal(friendlyError("not-found"), "No group found with that code. Check it, or ask for the invite link.");
  assert.equal(friendlyError("unavailable"), "Can't reach the server right now. Check your connection and try again.");
  assert.equal(friendlyError("resource-exhausted"), "The server is busy right now. Try again in a few minutes.");
  assert.equal(friendlyError("failed-precondition"), "That change doesn't fit the group as it is now. Reload the app and try again.");
  assert.equal(friendlyError("invalid-argument"), "Something in that entry can't be saved. Check it and try again.");
});

test("F-6: a refused change says why, by its field and what was being saved", function(){
  assert.equal(friendlyError({ code: "failed-precondition", field: "in-use" }, "person-delete"),
    "That person is in an expense now, so they can't be removed. Delete their expenses first.");
  assert.equal(friendlyError({ code: "failed-precondition", field: "group-full" }, "person"), "This group already has 100 people.");
  assert.equal(friendlyError({ code: "failed-precondition", field: "group-full" }, "expense"), "This group is full: it can't take more expenses.");
  assert.equal(friendlyError({ code: "invalid-argument", field: "split" }, "expense"),
    "Someone it's split among isn't in the group any more, or it's split among more than 100 people.");
  assert.equal(friendlyError({ code: "invalid-argument", field: "paidBy" }, "expense"), "The person who paid isn't in the group any more.");
  assert.equal(friendlyError({ code: "invalid-argument", field: "code" }), "That group link isn't valid.");
  // A field with no text of its own falls back to its code's text; nothing says "check the invite link".
  assert.equal(friendlyError({ code: "invalid-argument", field: "desc" }, "expense"), "Something in that entry can't be saved. Check it and try again.");
  assert.equal(friendlyError({ code: "failed-precondition", field: "group-full" }), "That change doesn't fit the group as it is now. Reload the app and try again.");
  // A field only picks the words for a refusal, never for "not found".
  assert.equal(friendlyError({ code: "not-found", field: "in-use" }), "No group found with that code. Check it, or ask for the invite link.");
});

test("the numbers in the texts are ledger-rules.js's limits", function(){
  assert.match(friendlyError({ code: "failed-precondition", field: "group-full" }, "person"), new RegExp("\\b" + MAX_PEOPLE + " people"));
  assert.match(friendlyError({ code: "invalid-argument", field: "split" }, "expense"), new RegExp("\\b" + MAX_SPLIT + " people"));
});

test("an error object is read by its code, and its own message is never shown", function(){
  const err = { code: "not-found", message: "no group goa-trip-2026" };
  assert.equal(friendlyError(err), "No group found with that code. Check it, or ask for the invite link.");
  const text = friendlyError({ code: "internal", message: "raw text from the server" });
  assert.doesNotMatch(text, /raw text/);
});

test("an unknown, missing or odd code gets the default message", function(){
  const fallback = "Something went wrong. Try again.";
  for(const odd of ["internal", "permission-denied", "deadline-exceeded", "", undefined, null, 42, {}, { code: 7 }, "toString", "__proto__", "constructor"]){
    assert.equal(friendlyError(odd), fallback, "for " + String(odd && odd.code !== undefined ? odd.code : odd));
  }
  // Odd fields and kinds don't reach into the object's prototype either.
  assert.equal(friendlyError({ code: "invalid-argument", field: "__proto__" }, "constructor"), "Something in that entry can't be saved. Check it and try again.");
  assert.equal(friendlyError({ code: "invalid-argument", field: "toString" }), "Something in that entry can't be saved. Check it and try again.");
});

// ---------- the status text ----------

const base = { online: true, heard: true, fromCache: false, pending: 0, failed: false };
function status(changes){ return syncStatusText(Object.assign({}, base, changes)); }

test("live only when online, the group has been read on the live connection, and nothing waits", function(){
  assert.equal(status({}), "live");
});

test("connecting… before the group is read, and while the live connection is down", function(){
  assert.equal(status({ heard: false }), "connecting…");
  assert.equal(status({ fromCache: true }), "connecting…");
});

test("offline says so, with or without changes waiting", function(){
  assert.equal(status({ online: false }), "offline: changes will sync when you're back online");
  assert.equal(status({ online: false, fromCache: true, heard: false }), "offline: changes will sync when you're back online");
  assert.equal(status({ online: false, pending: 1 }), "offline: 1 change waiting to sync");
  assert.equal(status({ online: false, pending: 3 }), "offline: 3 changes waiting to sync");
});

test("online with changes waiting counts them, and is never live (the T-03 review's E6)", function(){
  assert.equal(status({ pending: 1 }), "1 change waiting to sync");
  assert.equal(status({ pending: 2 }), "2 changes waiting to sync");
  assert.equal(status({ pending: 2, fromCache: true }), "2 changes waiting to sync");
});

test("syncing that stopped for good wins over everything else", function(){
  assert.equal(status({ failed: true }), "not syncing");
  assert.equal(status({ failed: true, online: false, pending: 2 }), "not syncing");
});

test("SF-022: an edit another phone got to first, or that doesn't fit, says so in plain words", function(){
  assert.equal(friendlyError({ code: "failed-precondition", field: "gone" }, "expense-edit"),
    "Someone else changed or deleted it first, so this edit wasn't saved.");
  assert.equal(friendlyError({ code: "failed-precondition", field: "group-full" }, "expense-edit"), "This group is full: it can't take more expenses.");
});
