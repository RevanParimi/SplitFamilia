// ledger-rules.js (SF-033): the limits the server enforces and, from T-09, the page checks first.
// The edges are worked out from the story card by hand.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkGroup, checkPerson, checkExpense, isValidId,
  MAX_AMOUNT_PAISE, MAX_CURRENCY_LENGTH, MAX_NAME_LENGTH, MAX_DESC_LENGTH, MAX_SPLIT, MAX_ID_LENGTH, MAX_PEOPLE,
  MAX_EXPENSES
} from "../ledger-rules.js";
import { MAX_AMOUNT_PAISE as MONEY_MAX } from "../money.js";

const people = ["asha", "ben", "chitra"];
function expense(changes){
  return Object.assign({ id: "e1", date: "2026-09-29T06:30:00.000Z", desc: "Hotel", amountPaise: 30000, paidBy: "asha", split: ["asha", "ben"] }, changes || {});
}

test("the limits are the card's, and the amount limit is money.js's", function(){
  assert.equal(MAX_AMOUNT_PAISE, MONEY_MAX);
  assert.equal(MAX_AMOUNT_PAISE, 1000000000);
  assert.deepEqual([MAX_CURRENCY_LENGTH, MAX_NAME_LENGTH, MAX_DESC_LENGTH, MAX_SPLIT, MAX_ID_LENGTH, MAX_PEOPLE], [3, 60, 200, 100, 64, 100]);
  // The owner's cap on a group's expenses, deleted ones included (D-17).
  assert.equal(MAX_EXPENSES, 5000);
});

test("IDs: 1 to 64 letters, digits, _ or -", function(){
  for(const ok of ["a", "A1_-", "a1b2C3d4E5f6G7h8I9j0", "0b9b5a3e-6f7c-4d1a-9e2b-8c7d6e5f4a3b", "x".repeat(64)]){
    assert.equal(isValidId(ok), true, ok);
  }
  for(const bad of ["", "x".repeat(65), "a b", "a/b", "a.b", "é", "a\n", 5, null, undefined, ["a"]]){
    assert.equal(isValidId(bad), false, String(bad));
  }
});

test("a group is exactly { currency } of 1 to 3 characters", function(){
  assert.equal(checkGroup({ currency: "₹" }), null);
  assert.equal(checkGroup({ currency: "Rs." }), null);
  assert.equal(checkGroup({ currency: "" }), "currency");
  assert.equal(checkGroup({ currency: "Rupe" }), "currency");
  assert.equal(checkGroup({ currency: " " }), "currency");
  assert.equal(checkGroup({ currency: 1 }), "currency");
  assert.equal(checkGroup({ currency: "₹", name: "Goa" }), "fields");
  assert.equal(checkGroup({}), "fields");
  assert.equal(checkGroup(null), "fields");
  assert.equal(checkGroup(["₹"]), "fields");
  assert.equal(checkGroup("₹"), "fields");
});

test("a person is exactly { id, name }, the name 1 to 60 UTF-16 units as maxlength counts", function(){
  assert.equal(checkPerson({ id: "p1", name: "Asha" }), null);
  assert.equal(checkPerson({ id: "p1", name: "x".repeat(60) }), null);
  assert.equal(checkPerson({ id: "p1", name: "अ".repeat(60) }), null);
  assert.equal(checkPerson({ id: "p1", name: "😀".repeat(30) }), null);
  assert.equal(checkPerson({ id: "p1", name: "😀".repeat(30) + "x" }), "name");
  assert.equal(checkPerson({ id: "p1", name: "x".repeat(61) }), "name");
  assert.equal(checkPerson({ id: "p1", name: "" }), "name");
  assert.equal(checkPerson({ id: "p1", name: "  \t" }), "name");
  assert.equal(checkPerson({ id: "p1", name: "\ud83d" }), "name"); // half an emoji
  assert.equal(checkPerson({ id: "p 1", name: "Asha" }), "id");
  assert.equal(checkPerson({ name: "Asha" }), "fields");
  assert.equal(checkPerson({ id: "p1", name: "Asha", admin: true }), "fields");
  // An own "__proto__" key from JSON is an extra field, not a way round the check.
  assert.equal(checkPerson(JSON.parse("{\"id\":\"p1\",\"name\":\"Asha\",\"__proto__\":{}}")), "fields");
});

test("an expense's shape: every field once, amounts in whole paise from 1 to the maximum", function(){
  assert.equal(checkExpense(expense()), null);
  assert.equal(checkExpense(expense(), people), null);
  assert.equal(checkExpense(expense({ amountPaise: 1 }), people), null);
  assert.equal(checkExpense(expense({ amountPaise: 1000000000 }), people), null);
  assert.equal(checkExpense(expense({ amountPaise: 1000000001 }), people), "amountPaise");
  assert.equal(checkExpense(expense({ amountPaise: 0 }), people), "amountPaise");
  assert.equal(checkExpense(expense({ amountPaise: 99.5 }), people), "amountPaise");
  assert.equal(checkExpense(expense({ amountPaise: "300" }), people), "amountPaise");
  assert.equal(checkExpense(expense({ amountPaise: Infinity }), people), "amountPaise");
  assert.equal(checkExpense(expense({ amountPaise: NaN }), people), "amountPaise");
  assert.equal(checkExpense(expense({ desc: "d".repeat(200) }), people), null);
  assert.equal(checkExpense(expense({ desc: "d".repeat(201) }), people), "desc");
  assert.equal(checkExpense(expense({ date: "2026-09-29T06:30:00Z" }), people), null);
  assert.equal(checkExpense(expense({ date: "2026-13-01T06:30:00.000Z" }), people), "date");
  assert.equal(checkExpense(expense({ date: "29/09/2026" }), people), "date");
  assert.equal(checkExpense(expense({ date: 20260929 }), people), "date");
  // A date must be a real moment, not one that rolls over to another day (T-08 review, N-4).
  // 2026 isn't a leap year; 2024 is.
  for(const date of ["2026-02-30T00:00:00.000Z", "2026-02-29T12:00:00Z", "2026-04-31T10:00:00.000Z", "2026-09-30T24:00:00Z", "2026-09-30T10:60:00Z"]){
    assert.equal(checkExpense(expense({ date: date }), people), "date", date);
  }
  for(const date of ["2024-02-29T12:00:00.000Z", "2026-09-30T23:59:59.999Z", "2026-12-31T00:00:00.5Z"]){
    assert.equal(checkExpense(expense({ date: date }), people), null, date);
  }
  const extra = expense();
  extra.note = "x";
  assert.equal(checkExpense(extra, people), "fields");
  const missing = expense();
  delete missing.split;
  assert.equal(checkExpense(missing, people), "fields");
});

test("an expense's people: the payer and 1 to 100 split members, each once, all in the group", function(){
  const many = Array.from({ length: 101 }, function(_, i){ return "p" + i; });
  assert.equal(checkExpense(expense({ paidBy: "p0", split: many.slice(0, 100) }), many), null); // a group trek
  assert.equal(checkExpense(expense({ paidBy: "p0", split: many }), many), "split"); // 101
  assert.equal(checkExpense(expense({ paidBy: "p0", split: many })), "split"); // even without the people
  assert.equal(checkExpense(expense({ split: [] }), people), "split");
  assert.equal(checkExpense(expense({ split: ["asha", "asha"] }), people), "split");
  assert.equal(checkExpense(expense({ split: "asha" }), people), "split");
  assert.equal(checkExpense(expense({ split: ["asha", "zed"] }), people), "split");
  assert.equal(checkExpense(expense({ split: ["asha", "zed"] })), null); // shape only
  assert.equal(checkExpense(expense({ paidBy: "zed" }), people), "paidBy");
  assert.equal(checkExpense(expense({ paidBy: "" }), people), "paidBy");
  assert.equal(checkExpense(expense({ paidBy: "asha" }), new Set(people)), null);
});
