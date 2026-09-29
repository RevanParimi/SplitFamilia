// Tests for money.js: exact paise (SF-004). SF-001's scenarios are kept, in paise.
// Expected values are worked out by hand in the comments, not copied from the code.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_AMOUNT_PAISE, toPaise, expenseProblem, splitShares, computeBalances, simplifyDebts,
  formatPaise, parseAmountInput
} from "../money.js";

const asha = { id: "asha", name: "Asha" };
const ben = { id: "ben", name: "Ben" };
const chitra = { id: "chitra", name: "Chitra" };

function expense(amount, paidBy, split){
  return { amount: amount, paidBy: paidBy, split: split, desc: "x", date: "2026-09-28T12:00:00+05:30" };
}

function asObject(balances){ return Object.fromEntries(balances); }

function sum(balances){
  let total = 0;
  balances.forEach(function(v){ total += v; });
  return total;
}

// Applies the payments to a copy of the balances and returns the result.
function settle(balances, txns){
  const after = new Map(balances);
  txns.forEach(function(t){
    after.set(t.from, after.get(t.from) + t.amount);
    after.set(t.to, after.get(t.to) - t.amount);
  });
  return after;
}

function deepFreeze(value){
  if(value && typeof value === "object"){
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

// ---------- splitting ----------

test("₹100 among three: the extra paisa goes to the first ID in sorted order", function(){
  // 10000 / 3 = 3333 each, leftover 1 → asha (first of asha, ben, chitra).
  assert.deepEqual(splitShares(10000, ["asha", "ben", "chitra"]), [
    { id: "asha", paise: 3334 }, { id: "ben", paise: 3333 }, { id: "chitra", paise: 3333 }
  ]);
  // The same split in another order gives the same shares.
  assert.deepEqual(splitShares(10000, ["chitra", "asha", "ben"]), [
    { id: "asha", paise: 3334 }, { id: "ben", paise: 3333 }, { id: "chitra", paise: 3333 }
  ]);
});

test("one paisa among three: only the first sorted ID pays it", function(){
  assert.deepEqual(splitShares(1, ["ben", "chitra", "asha"]), [
    { id: "asha", paise: 1 }, { id: "ben", paise: 0 }, { id: "chitra", paise: 0 }
  ]);
});

test("sorting is by code unit, not locale: uppercase sorts before lowercase", function(){
  // Firestore auto-IDs mix cases. "B" (66) < "a" (97), so "Bx" gets the leftover paisa.
  assert.deepEqual(splitShares(2, ["a1", "Bx", "c9"]), [
    { id: "Bx", paise: 1 }, { id: "a1", paise: 1 }, { id: "c9", paise: 0 }
  ]);
});

test("shares always add up to the total", function(){
  [1, 2, 99, 100, 101, 10000, 33333, MAX_AMOUNT_PAISE].forEach(function(total){
    for(let n = 1; n <= 7; n++){
      const ids = ["g", "e", "a", "f", "c", "b", "d"].slice(0, n);
      const shares = splitShares(total, ids);
      assert.equal(shares.reduce(function(s, x){ return s + x.paise; }, 0), total);
      shares.forEach(function(x){ assert.ok(Number.isSafeInteger(x.paise)); });
    }
  });
});

// ---------- reading stored amounts ----------

test("stored amounts become whole paise", function(){
  assert.equal(toPaise(0.30000000000000004), 30);
  assert.equal(toPaise(100), 10000);
  assert.equal(toPaise(33.33), 3333);
  assert.equal(toPaise(0.01), 1);
  assert.equal(toPaise(10000000), MAX_AMOUNT_PAISE);
  // Every paise value written as paise / 100 reads back exactly.
  for(let p = 1; p <= 200000; p++) assert.equal(toPaise(p / 100), p);
  [123456789, 999999999, 1000000000, 314159265].forEach(function(p){ assert.equal(toPaise(p / 100), p); });
});

test("amounts that are not a number in (0, ₹1,00,00,000] are rejected", function(){
  [1e308, Infinity, -Infinity, NaN, "300", 0, -5, 10000000.01, null, undefined].forEach(function(bad){
    assert.equal(toPaise(bad), null, String(bad));
  });
});

// ---------- balances ----------

test("one payer, even three-way split", function(){
  // Asha pays ₹300 split A/B/C: 10000 paise each.
  // Asha +30000 −10000 = +20000, Ben −10000, Chitra −10000.
  const balances = computeBalances([asha, ben, chitra], [expense(300, "asha", ["asha", "ben", "chitra"])]);
  assert.deepEqual(asObject(balances), { asha: 20000, ben: -10000, chitra: -10000 });
  // Ben and Chitra tie at 10000; ties go by ID.
  assert.deepEqual(simplifyDebts(balances), [
    { from: "ben", to: "asha", amount: 10000 },
    { from: "chitra", to: "asha", amount: 10000 }
  ]);
});

test("two expenses, largest debtor pays first", function(){
  // Asha pays ₹90 split A/B/C (3000 each): A +6000, B −3000, C −3000.
  // Ben pays ₹30 split B/C (1500 each): B +1500, C −1500.
  // Totals: A +6000, B −1500, C −4500.
  const balances = computeBalances([asha, ben, chitra], [
    expense(90, "asha", ["asha", "ben", "chitra"]),
    expense(30, "ben", ["ben", "chitra"])
  ]);
  assert.deepEqual(asObject(balances), { asha: 6000, ben: -1500, chitra: -4500 });
  assert.deepEqual(simplifyDebts(balances), [
    { from: "chitra", to: "asha", amount: 4500 },
    { from: "ben", to: "asha", amount: 1500 }
  ]);
});

test("₹100 three ways now balances to the paisa (was 33.33 + 33.33 before SF-004)", function(){
  // Shares: asha 3334, ben 3333, chitra 3333. Asha +10000 −3334 = +6666.
  const balances = computeBalances([asha, ben, chitra], [expense(100, "asha", ["asha", "ben", "chitra"])]);
  assert.deepEqual(asObject(balances), { asha: 6666, ben: -3333, chitra: -3333 });
  assert.equal(sum(balances), 0);
  assert.deepEqual(simplifyDebts(balances), [
    { from: "ben", to: "asha", amount: 3333 },
    { from: "chitra", to: "asha", amount: 3333 }
  ]);
});

test("the story's worked example: A pays ₹100 for A/B/C, B pays ₹50 for B/C", function(){
  // Expense 1: shares A 3334, B 3333, C 3333 → A +6666, B −3333, C −3333.
  // Expense 2: 5000 / 2 = 2500 each → B +5000 −2500 = +2500, C −2500.
  // Totals: A +6666, B −833, C −5833; sum 0.
  const balances = computeBalances([asha, ben, chitra], [
    expense(100, "asha", ["asha", "ben", "chitra"]),
    expense(50, "ben", ["ben", "chitra"])
  ]);
  assert.deepEqual(asObject(balances), { asha: 6666, ben: -833, chitra: -5833 });
  assert.equal(sum(balances), 0);
  assert.deepEqual(simplifyDebts(balances), [
    { from: "chitra", to: "asha", amount: 5833 },
    { from: "ben", to: "asha", amount: 833 }
  ]);
});

test("one debtor pays two creditors, biggest creditor first", function(){
  // Chitra owes 8000; Asha is owed 5000, Ben 3000.
  assert.deepEqual(simplifyDebts(new Map([["asha", 5000], ["ben", 3000], ["chitra", -8000]])), [
    { from: "chitra", to: "asha", amount: 5000 },
    { from: "chitra", to: "ben", amount: 3000 }
  ]);
});

test("a one-paisa balance is a real debt now (no tolerance)", function(){
  assert.deepEqual(simplifyDebts(new Map([["asha", 1], ["ben", -1]])), [{ from: "ben", to: "asha", amount: 1 }]);
});

test("no people or no expenses means no settlements", function(){
  assert.deepEqual(asObject(computeBalances([], [])), {});
  assert.deepEqual(simplifyDebts(computeBalances([], [])), []);
  assert.deepEqual(asObject(computeBalances([asha, ben], [])), { asha: 0, ben: 0 });
  assert.deepEqual(simplifyDebts(computeBalances([asha, ben], [])), []);
});

// ---------- removed people (changed on purpose by SF-004) ----------

test("a removed split member keeps their share, so the balances still sum to 0", function(){
  // Asha pays ₹300 split A/B/C, but Chitra was removed. Shares 10000 each.
  // Before SF-004 Chitra's 10000 vanished. Now: Asha +20000, Ben −10000, Chitra −10000.
  const balances = computeBalances([asha, ben], [expense(300, "asha", ["asha", "ben", "chitra"])]);
  assert.deepEqual(asObject(balances), { asha: 20000, ben: -10000, chitra: -10000 });
  assert.equal(sum(balances), 0);
  assert.deepEqual(simplifyDebts(balances), [
    { from: "ben", to: "asha", amount: 10000 },
    { from: "chitra", to: "asha", amount: 10000 }
  ]);
});

test("a removed payer keeps their credit (the expense is no longer skipped)", function(){
  // Chitra (removed) paid ₹60 for Asha and Ben: 3000 each.
  // Before SF-004 the whole expense was skipped. Now: Chitra +6000, Asha −3000, Ben −3000.
  const balances = computeBalances([asha, ben], [expense(60, "chitra", ["asha", "ben"])]);
  assert.deepEqual(asObject(balances), { asha: -3000, ben: -3000, chitra: 6000 });
  assert.deepEqual(simplifyDebts(balances), [
    { from: "asha", to: "chitra", amount: 3000 },
    { from: "ben", to: "chitra", amount: 3000 }
  ]);
});

test("F-2: built-in names such as 'constructor' are treated like any other missing person", function(){
  // The same expense as above, paid by "constructor" instead of "chitra": same numbers.
  const balances = computeBalances([asha, ben], [expense(60, "constructor", ["asha", "ben"])]);
  assert.deepEqual([...balances], [["asha", -3000], ["ben", -3000], ["constructor", 6000]]);
  ["toString", "__proto__", "hasOwnProperty"].forEach(function(name){
    // ₹90 paid by Asha for Asha, Ben and the missing person: 3000 each.
    const b = computeBalances([asha, ben], [expense(90, "asha", ["asha", "ben", name])]);
    assert.equal(b.get(name), -3000, name);
    assert.equal(b.get("asha"), 6000, name);
    assert.equal(sum(b), 0, name);
  });
});

// ---------- F-1 and empty splits: stored data the form can't produce ----------

test("F-1: bad stored amounts are left out, and the call returns", function(){
  // Only the valid ₹30 expense counts: Asha +1500, Ben −1500.
  const bad = [1e308, Infinity, NaN, "300"].map(function(a){ return expense(a, "asha", ["asha", "ben"]); });
  const balances = computeBalances([asha, ben], bad.concat([expense(30, "asha", ["asha", "ben"])]));
  assert.deepEqual(asObject(balances), { asha: 1500, ben: -1500 });
  bad.forEach(function(exp){ assert.equal(expenseProblem(exp), "amount"); });
  assert.deepEqual(simplifyDebts(balances), [{ from: "ben", to: "asha", amount: 1500 }]);
});

test("F-1: two ₹1e308 expenses no longer freeze the page", function(){
  // Before SF-004 these made Asha's balance Infinity, and simplifyDebts looped forever.
  const balances = computeBalances([asha, ben], [
    expense(1e308, "asha", ["asha", "ben"]),
    expense(1e308, "asha", ["asha", "ben"])
  ]);
  assert.deepEqual(asObject(balances), { asha: 0, ben: 0 });
  assert.deepEqual(simplifyDebts(balances), []);
});

test("simplifyDebts ends even when handed non-integer balances", function(){
  // computeBalances never makes these; simplifyDebts ignores them instead of looping.
  const txns = simplifyDebts(new Map([["a", Infinity], ["b", Infinity], ["c", -Infinity], ["d", NaN], ["e", 1.5], ["f", 500], ["g", -500]]));
  assert.deepEqual(txns, [{ from: "g", to: "f", amount: 500 }]);
});

test("an empty, missing or malformed split is left out and flagged", function(){
  // Before SF-004 an empty split credited the payer ₹300 with nobody debited,
  // and a missing split threw. Now both are left out: every balance stays 0.
  const cases = [
    expense(300, "asha", []),
    { amount: 300, paidBy: "asha", desc: "x", date: "2026-09-28T12:00:00+05:30" },
    expense(300, "asha", "asha,ben"),
    expense(300, "asha", ["asha", null]),
    expense(300, "asha", ["asha", ""])
  ];
  cases.forEach(function(exp){ assert.equal(expenseProblem(exp), "split"); });
  const balances = computeBalances([asha, ben], cases);
  assert.deepEqual(asObject(balances), { asha: 0, ben: 0 });
});

test("a missing payer is left out and flagged", function(){
  [undefined, "", 42, null].forEach(function(paidBy){
    const exp = expense(300, paidBy, ["asha", "ben"]);
    assert.equal(expenseProblem(exp), "payer", String(paidBy));
    assert.deepEqual(asObject(computeBalances([asha, ben], [exp])), { asha: 0, ben: 0 });
  });
  assert.equal(expenseProblem(expense(300, "asha", ["asha"])), null);
});

// ---------- the property check ----------

// A small seeded generator (mulberry32), so a failure can be replayed.
function makeRandom(seed){
  return function(){
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("property: 1000 random groups balance to 0, and the settlements clear everyone", function(){
  const rand = makeRandom(20260929);
  const pick = function(list){ return list[Math.floor(rand() * list.length)]; };
  const oddAmounts = [1e308, Infinity, NaN, "300", 0, -1, 0.30000000000000004, 33.333, 10000000];
  for(let g = 0; g < 1000; g++){
    const people = [];
    const n = 1 + Math.floor(rand() * 8);
    for(let k = 0; k < n; k++) people.push({ id: "p" + Math.floor(rand() * 1e6).toString(36) + k });
    // Removed people and awkward IDs that the balances must still handle.
    const everyone = people.map(function(p){ return p.id; }).concat(["gone1", "constructor", "__proto__"]);
    const expenses = [];
    const m = Math.floor(rand() * 25);
    for(let e = 0; e < m; e++){
      const amount = rand() < 0.1 ? pick(oddAmounts) : (1 + Math.floor(rand() * rand() * MAX_AMOUNT_PAISE)) / 100;
      const split = everyone.filter(function(){ return rand() < 0.5; });
      if(rand() < 0.05) split.length = 0;
      expenses.push(expense(amount, pick(everyone), split));
    }
    const balances = computeBalances(people, expenses);
    balances.forEach(function(v, id){ assert.ok(Number.isSafeInteger(v), "group " + g + ": " + id + " = " + v); });
    assert.equal(sum(balances), 0, "group " + g);
    const txns = simplifyDebts(balances);
    txns.forEach(function(t){ assert.ok(Number.isSafeInteger(t.amount) && t.amount > 0, "group " + g); });
    settle(balances, txns).forEach(function(v, id){ assert.equal(v, 0, "group " + g + ": " + id); });
    const owing = [...balances.values()].filter(function(v){ return v !== 0; }).length;
    assert.ok(txns.length <= Math.max(0, owing - 1), "group " + g + ": too many payments");
  }
});

test("pure: inputs are not changed and repeat calls agree", function(){
  const people = deepFreeze([asha, ben, chitra].map(function(p){ return Object.assign({}, p); }));
  const expenses = deepFreeze([expense(90, "asha", ["chitra", "asha", "ben"]), expense(30, "ben", ["ben", "chitra"])]);
  // Modules run in strict mode, so writing to a frozen object (or sorting a frozen split) would throw.
  const first = computeBalances(people, expenses);
  const second = computeBalances(people, expenses);
  assert.deepEqual(first, second);
  const copy = new Map(first);
  assert.deepEqual(simplifyDebts(first), simplifyDebts(first));
  assert.deepEqual(first, copy);
});

// ---------- showing and typing amounts ----------

test("amounts are shown with two decimals from paise", function(){
  assert.equal(formatPaise(3334, "en-US"), "33.34");
  assert.equal(formatPaise(1, "en-US"), "0.01");
  assert.equal(formatPaise(10000, "en-US"), "100.00");
  assert.equal(formatPaise(123456, "en-US"), "1,234.56");
  assert.equal(formatPaise(MAX_AMOUNT_PAISE, "en-IN"), "1,00,00,000.00");
});

test("the amount field accepts up to 2 decimals and turns them into exact paise", function(){
  assert.deepEqual(parseAmountInput("250"), { paise: 25000 });
  assert.deepEqual(parseAmountInput(" 99.5 "), { paise: 9950 });
  assert.deepEqual(parseAmountInput("0.29"), { paise: 29 });
  assert.deepEqual(parseAmountInput("0.01"), { paise: 1 });
  assert.deepEqual(parseAmountInput(".5"), { paise: 50 });
  assert.deepEqual(parseAmountInput("12."), { paise: 1200 });
  assert.deepEqual(parseAmountInput("007.50"), { paise: 750 });
  assert.deepEqual(parseAmountInput("10000000"), { paise: MAX_AMOUNT_PAISE });
  assert.deepEqual(parseAmountInput("10000000.00"), { paise: MAX_AMOUNT_PAISE });
});

test("the amount field rejects bad input with a clear message", function(){
  const cases = {
    "": "Enter an amount.",
    "   ": "Enter an amount.",
    "abc": "Enter a number, like 250 or 99.50.",
    ".": "Enter a number, like 250 or 99.50.",
    "1e308": "Enter a number, like 250 or 99.50.",
    "1,500": "Enter a number, like 250 or 99.50.",
    "0": "Enter an amount greater than 0.",
    "0.00": "Enter an amount greater than 0.",
    "-5": "Enter an amount greater than 0.",
    "10.555": "Use at most 2 decimal places.",
    "0.001": "Use at most 2 decimal places.",
    "10000000.01": "The largest amount allowed is 1,00,00,000.00.",
    "99999999999999999999": "The largest amount allowed is 1,00,00,000.00."
  };
  Object.keys(cases).forEach(function(input){
    assert.deepEqual(parseAmountInput(input, "en-IN"), { error: cases[input] }, JSON.stringify(input));
  });
});

test("what the form stores reads back as the same paise", function(){
  // The form stores paise / 100 as a decimal number; reading it back gives the same paise.
  ["0.29", "33.33", "99.99", "1234567.89", "10000000"].forEach(function(text){
    const paise = parseAmountInput(text).paise;
    assert.equal(toPaise(paise / 100), paise, text);
  });
});
