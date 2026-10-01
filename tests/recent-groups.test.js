// recent-groups.js (SF-029): the groups opened on this phone, and the dates the page writes.
// Pure functions; the expected lists and texts are worked out by hand from the card.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RECENT_KEY, MAX_RECENT, readRecent, rememberGroup, forgetGroup, wantsInvite, inviteDone, shortDate, openedText
} from "../recent-groups.js";
import { isValidGroupId } from "../group-code.js";

const codes = function(list){ return list.map(function(e){ return e.code; }); };
// Times in the phone's own zone, as the page sees them.
const at = function(y, m, d, h, min){ return new Date(y, m - 1, d, h || 0, min || 0).getTime(); };

test("the list has its own key, beside the current group's, and holds at most 20", function(){
  assert.equal(RECENT_KEY, "splitfamilia-recent");
  assert.notEqual(RECENT_KEY, "splitsheet-group");
  assert.equal(MAX_RECENT, 20);
});

test("opening a group puts it at the top; opening one already there moves it up, with no duplicate", function(){
  let list = [];
  list = rememberGroup(list, "goa-trip-7k2m9xqpwd", 1000, isValidGroupId);
  list = rememberGroup(list, "diwali-party-2026-a9a9ijkeit", 2000, isValidGroupId);
  list = rememberGroup(list, "ooty-weekend", 3000, isValidGroupId);
  assert.deepEqual(codes(list), ["ooty-weekend", "diwali-party-2026-a9a9ijkeit", "goa-trip-7k2m9xqpwd"]);
  const again = rememberGroup(list, "goa-trip-7k2m9xqpwd", 4000, isValidGroupId);
  assert.deepEqual(again, [
    { code: "goa-trip-7k2m9xqpwd", openedAt: 4000 },
    { code: "ooty-weekend", openedAt: 3000 },
    { code: "diwali-party-2026-a9a9ijkeit", openedAt: 2000 }
  ]);
  // The list passed in is left as it was.
  assert.deepEqual(codes(list), ["ooty-weekend", "diwali-party-2026-a9a9ijkeit", "goa-trip-7k2m9xqpwd"]);
});

test("past 20, the group opened longest ago is dropped", function(){
  let list = [];
  for(let i = 1; i <= 20; i++) list = rememberGroup(list, "trip-" + i, i, isValidGroupId);
  assert.equal(list.length, 20);
  list = rememberGroup(list, "trip-21", 21, isValidGroupId);
  assert.equal(list.length, 20);
  assert.equal(list[0].code, "trip-21");
  assert.equal(list[19].code, "trip-2");
  assert.ok(!codes(list).includes("trip-1"));
  // Re-opening one in the list drops nothing.
  list = rememberGroup(list, "trip-10", 22, isValidGroupId);
  assert.equal(list.length, 20);
  assert.equal(list[19].code, "trip-2");
});

test("invalid entries are ignored: bad codes, bad times, duplicates, and text that isn't a list", function(){
  const stored = JSON.stringify([
    { code: "goa-trip-7k2m9xqpwd", openedAt: 5000 },
    { code: "Goa-Trip", openedAt: 4000 },
    { code: "goa--trip", openedAt: 4000 },
    { code: "a".repeat(81), openedAt: 4000 },
    { code: "ooty", openedAt: "yesterday" },
    { code: "ooty", openedAt: -1 },
    { code: "ooty", openedAt: 1.5 },
    { code: "goa-trip-7k2m9xqpwd", openedAt: 3000 },
    null, "diwali", 7, ["x"],
    { openedAt: 2000 },
    { code: "diwali", openedAt: 2000, invite: true, extra: "dropped" },
    { code: "pune", openedAt: 1000, invite: "yes" }
  ]);
  assert.deepEqual(readRecent(stored, isValidGroupId), [
    { code: "goa-trip-7k2m9xqpwd", openedAt: 5000 },
    { code: "diwali", openedAt: 2000, invite: true },
    { code: "pune", openedAt: 1000 }
  ]);
  for(const text of [null, "", "not json", "{}", "\"goa\"", "42", "{\"code\":\"goa\"}"]){
    assert.deepEqual(readRecent(text, isValidGroupId), [], String(text));
  }
  // More than 20 stored (by an older or a tampered copy): the first 20 are kept.
  const many = JSON.stringify(Array.from({ length: 25 }, function(_, i){ return { code: "trip-" + i, openedAt: 100 - i }; }));
  assert.deepEqual(codes(readRecent(many, isValidGroupId)), Array.from({ length: 20 }, function(_, i){ return "trip-" + i; }));
  // An invalid code is never added.
  assert.deepEqual(rememberGroup([{ code: "goa", openedAt: 1 }], "Not A Code", 2, isValidGroupId), [{ code: "goa", openedAt: 1 }]);
});

test("removing one entry leaves the rest in order, and only touches this list", function(){
  const list = [
    { code: "a-trip", openedAt: 3 }, { code: "b-trip", openedAt: 2, invite: true }, { code: "c-trip", openedAt: 1 }
  ];
  assert.deepEqual(forgetGroup(list, "b-trip"), [{ code: "a-trip", openedAt: 3 }, { code: "c-trip", openedAt: 1 }]);
  assert.deepEqual(forgetGroup(list, "a-trip"), [{ code: "b-trip", openedAt: 2, invite: true }, { code: "c-trip", openedAt: 1 }]);
  assert.deepEqual(forgetGroup(list, "not-there"), list);
  assert.equal(list.length, 3);
});

test("a group started here offers 'Invite your group' until the link is copied or 'Not now'", function(){
  let list = rememberGroup([], "joined-trip", 1, isValidGroupId);
  list = rememberGroup(list, "new-trip-a9a9ijkeit", 2, isValidGroupId, true);
  assert.equal(wantsInvite(list, "new-trip-a9a9ijkeit"), true);
  assert.equal(wantsInvite(list, "joined-trip"), false);
  // Opening it again later keeps the offer.
  list = rememberGroup(list, "new-trip-a9a9ijkeit", 3, isValidGroupId);
  assert.equal(wantsInvite(list, "new-trip-a9a9ijkeit"), true);
  list = inviteDone(list, "new-trip-a9a9ijkeit");
  assert.equal(wantsInvite(list, "new-trip-a9a9ijkeit"), false);
  assert.deepEqual(list, [{ code: "new-trip-a9a9ijkeit", openedAt: 3 }, { code: "joined-trip", openedAt: 1 }]);
  // And it stays done when the group is opened again.
  assert.equal(wantsInvite(rememberGroup(list, "new-trip-a9a9ijkeit", 4, isValidGroupId), "new-trip-a9a9ijkeit"), false);
});

test("ledger dates: day and month, with the year only when it isn't this year (SF-028)", function(){
  const now = at(2026, 10, 1, 10, 22);
  assert.equal(shortDate(at(2026, 9, 29, 17, 30), now), "29 Sep");
  assert.equal(shortDate(at(2026, 1, 1, 0, 0), now), "1 Jan");
  assert.equal(shortDate(at(2025, 12, 30, 18, 0), now), "30 Dec 2025");
  assert.equal(shortDate(at(2027, 2, 3), now), "3 Feb 2027");
  // From the ISO text the server keeps, in the phone's zone.
  const iso = new Date(at(2026, 9, 28, 21, 0)).toISOString();
  assert.equal(shortDate(iso, now), "28 Sep");
});

test("'Opened …': just now, minutes, hours today, yesterday, then the date", function(){
  const now = at(2026, 10, 1, 10, 22);
  assert.equal(openedText(now, now), "just now");
  assert.equal(openedText(now - 59 * 1000, now), "just now");
  assert.equal(openedText(now + 5000, now), "just now"); // a clock a little behind
  assert.equal(openedText(now - 60 * 1000, now), "1 minute ago");
  assert.equal(openedText(now - 2 * 60 * 1000, now), "2 minutes ago");
  assert.equal(openedText(now - 59 * 60 * 1000, now), "59 minutes ago");
  assert.equal(openedText(now - 60 * 60 * 1000, now), "1 hour ago");
  assert.equal(openedText(at(2026, 10, 1, 0, 5), now), "10 hours ago");
  assert.equal(openedText(at(2026, 9, 30, 23, 59), now), "yesterday");
  assert.equal(openedText(at(2026, 9, 30, 0, 0), now), "yesterday");
  assert.equal(openedText(at(2026, 9, 29, 23, 59), now), "on 29 Sep");
  assert.equal(openedText(at(2026, 8, 12, 9, 0), now), "on 12 Aug");
  assert.equal(openedText(at(2025, 12, 31, 9, 0), now), "on 31 Dec 2025");
  // Just after midnight: under an hour ago still counts in minutes; the evening before is "yesterday".
  const lateNow = at(2026, 10, 1, 0, 10);
  assert.equal(openedText(at(2026, 9, 30, 23, 50), lateNow), "20 minutes ago");
  assert.equal(openedText(at(2026, 9, 30, 22, 0), lateNow), "yesterday");
});
