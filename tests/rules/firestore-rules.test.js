// Emulator tests for firestore.rules (SF-007): every allowed case must pass and every denied case
// must be refused. Run with `npm run test:rules`, which starts the Firestore emulator for the
// project "demo-splitfamilia". A "demo-" project ID never reaches a real Firebase project, so
// nothing here can touch the family's data. Needs Java 21 and `npm install` first (see
// docs/google-play/FIRESTORE_RULES.md). `npm test` doesn't run this file: it needs the emulator.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import {
  doc, collection, collectionGroup, query, limit,
  getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc
} from "firebase/firestore";

const PROJECT_ID = "demo-splitfamilia";
const GROUP = "goa-trip-2026"; // an old-style code, made from the group's name
const NEW_GROUP = "goa-trip-7k2m9xqpwd"; // a new-style code with its random part

let env;

before(async function(){
  assert.ok(PROJECT_ID.startsWith("demo-"), "the project ID must be a demo- one");
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, "run through `npm run test:rules`, which starts the emulator");
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8") }
  });
});

after(async function(){ if(env) await env.cleanup(); });

// Each test starts from the same small group, written with the rules switched off.
beforeEach(async function(){
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async function(ctx){
    const admin = ctx.firestore();
    await setDoc(doc(admin, "groups", GROUP), { currency: "₹" });
    await setDoc(doc(admin, "groups", GROUP, "people", "asha"), { name: "Asha" });
    await setDoc(doc(admin, "groups", GROUP, "people", "ben"), { name: "Ben" });
    await setDoc(doc(admin, "groups", GROUP, "expenses", "e1"), expense());
    await setDoc(doc(admin, "other", "x"), { a: 1 });
  });
});

// The app has no sign-in, so every request is unauthenticated.
function db(){ return env.unauthenticatedContext().firestore(); }

// An expense exactly as the app writes it, with fields changed or removed by `changes`
// (a value of undefined removes the field).
function expense(changes){
  const e = { date: "2026-09-29T06:30:00.000Z", desc: "Hotel", amount: 300, paidBy: "asha", split: ["asha", "ben"] };
  Object.entries(changes || {}).forEach(function([k, v]){ if(v === undefined) delete e[k]; else e[k] = v; });
  return e;
}

const people = function(gid){ return collection(db(), "groups", gid, "people"); };
const expenses = function(gid){ return collection(db(), "groups", gid, "expenses"); };
const ids = function(n){ return Array.from({ length: n }, function(_, i){ return "p" + i; }); };

// ---------- allowed ----------

test("allowed: open a group by its code, whether or not it has a group document", async function(){
  await assertSucceeds(getDoc(doc(db(), "groups", GROUP)));
  await assertSucceeds(getDoc(doc(db(), "groups", "no-such-group"))); // old groups may have none
  await assertSucceeds(getDoc(doc(db(), "groups", "a".repeat(80))));
});

test("allowed: read a group's people and expenses, as the ledger and the Join check do", async function(){
  await assertSucceeds(getDocs(people(GROUP)));
  await assertSucceeds(getDocs(expenses(GROUP)));
  await assertSucceeds(getDocs(query(people(GROUP), limit(1))));
  await assertSucceeds(getDocs(query(expenses(GROUP), limit(1))));
  await assertSucceeds(getDoc(doc(db(), "groups", GROUP, "people", "asha")));
  await assertSucceeds(getDoc(doc(db(), "groups", GROUP, "expenses", "e1")));
});

test("allowed: start a new group ({ currency: '₹' }, merged) and change its currency", async function(){
  await assertSucceeds(setDoc(doc(db(), "groups", NEW_GROUP), { currency: "₹" }, { merge: true }));
  await assertSucceeds(setDoc(doc(db(), "groups", NEW_GROUP), { currency: "$" }, { merge: true }));
  await assertSucceeds(setDoc(doc(db(), "groups", GROUP), { currency: "Rs." }, { merge: true }));
  await assertSucceeds(updateDoc(doc(db(), "groups", GROUP), { currency: "€" }));
});

test("allowed: add a person with a name of 1 to 60 characters, in any script", async function(){
  await assertSucceeds(addDoc(people(GROUP), { name: "Chitra" }));
  await assertSucceeds(addDoc(people(GROUP), { name: "C" }));
  await assertSucceeds(addDoc(people(GROUP), { name: "x".repeat(60) }));
  // The page's maxlength="60" counts UTF-16 units, so these are the longest it lets through.
  await assertSucceeds(addDoc(people(GROUP), { name: "अ".repeat(60) }));
  await assertSucceeds(addDoc(people(GROUP), { name: "😀".repeat(30) }));
});

test("allowed: add an expense exactly as the app writes it, at the edges of each limit", async function(){
  await assertSucceeds(addDoc(expenses(GROUP), expense()));
  await assertSucceeds(addDoc(expenses(GROUP), expense({ amount: 99.5 })));
  await assertSucceeds(addDoc(expenses(GROUP), expense({ amount: 0.01 })));
  await assertSucceeds(addDoc(expenses(GROUP), expense({ amount: 10000000 }))); // MAX_AMOUNT_PAISE / 100
  await assertSucceeds(addDoc(expenses(GROUP), expense({ desc: "d".repeat(200) })));
  await assertSucceeds(addDoc(expenses(GROUP), expense({ desc: "च".repeat(200) })));
  await assertSucceeds(addDoc(expenses(GROUP), expense({ split: ["asha"] })));
  await assertSucceeds(addDoc(expenses(GROUP), expense({ split: ids(50) })));
  await assertSucceeds(addDoc(expenses(NEW_GROUP), expense()));
});

test("allowed: delete a person and an expense", async function(){
  await assertSucceeds(deleteDoc(doc(db(), "groups", GROUP, "people", "ben")));
  await assertSucceeds(deleteDoc(doc(db(), "groups", GROUP, "expenses", "e1")));
});

// ---------- denied ----------

test("denied: listing every group", async function(){
  await assertFails(getDocs(collection(db(), "groups")));
  await assertFails(getDocs(query(collection(db(), "groups"), limit(1))));
});

test("denied: collection-group queries across groups", async function(){
  await assertFails(getDocs(collectionGroup(db(), "people")));
  await assertFails(getDocs(collectionGroup(db(), "expenses")));
});

test("denied: codes the app would never make", async function(){
  for(const bad of ["Goa-Trip", "goa--trip", "-goa", "goa-", "goa_trip", "goa trip", "goa.trip", "a".repeat(81)]){
    await assertFails(getDoc(doc(db(), "groups", bad)));
    await assertFails(getDocs(collection(db(), "groups", bad, "people")));
    await assertFails(getDocs(collection(db(), "groups", bad, "expenses")));
    await assertFails(setDoc(doc(db(), "groups", bad), { currency: "₹" }));
    await assertFails(addDoc(collection(db(), "groups", bad, "people"), { name: "Asha" }));
    await assertFails(addDoc(collection(db(), "groups", bad, "expenses"), expense()));
  }
});

test("denied: a group document that isn't exactly { currency } of 1 to 3 characters", async function(){
  const g = doc(db(), "groups", NEW_GROUP);
  await assertFails(setDoc(g, { currency: "₹", name: "Goa" }));
  await assertFails(setDoc(g, {}));
  await assertFails(setDoc(g, { currency: "" }));
  await assertFails(setDoc(g, { currency: "Rupe" }));
  await assertFails(setDoc(g, { currency: 1 }));
  await assertFails(setDoc(doc(db(), "groups", GROUP), { owner: "x" }, { merge: true })); // merged, it has two keys
});

test("denied: deleting a group document", async function(){
  await assertFails(deleteDoc(doc(db(), "groups", GROUP)));
});

test("denied: a person that isn't exactly { name } of 1 to 60 characters", async function(){
  await assertFails(addDoc(people(GROUP), { name: "Asha", admin: true }));
  await assertFails(addDoc(people(GROUP), {}));
  await assertFails(addDoc(people(GROUP), { name: "" }));
  await assertFails(addDoc(people(GROUP), { name: "x".repeat(61) }));
  await assertFails(addDoc(people(GROUP), { name: 7 }));
});

test("denied: an expense that isn't ledger-shaped", async function(){
  const bad = [
    { amount: "lots" }, { amount: "300" }, { amount: 0 }, { amount: -5 }, { amount: 10000000.01 },
    { amount: NaN }, { amount: Infinity }, { amount: undefined },
    { desc: "" }, { desc: "d".repeat(201) }, { desc: 5 }, { desc: undefined },
    { split: [] }, { split: ids(51) }, { split: "asha" }, { split: undefined },
    { paidBy: "" }, { paidBy: 5 }, { paidBy: undefined },
    { date: 20260929 }, { date: "" }, { date: undefined },
    { note: "extra field" }
  ];
  for(const changes of bad){
    await assertFails(addDoc(expenses(GROUP), expense(changes)));
  }
});

test("denied: editing a person or an expense (SF-022 and SF-023 will open what they need)", async function(){
  await assertFails(updateDoc(doc(db(), "groups", GROUP, "people", "asha"), { name: "Asha K" }));
  await assertFails(setDoc(doc(db(), "groups", GROUP, "people", "asha"), { name: "Asha K" }));
  await assertFails(updateDoc(doc(db(), "groups", GROUP, "expenses", "e1"), { amount: 1 }));
  await assertFails(setDoc(doc(db(), "groups", GROUP, "expenses", "e1"), expense({ amount: 1 })));
});

test("denied: every other path", async function(){
  await assertFails(getDoc(doc(db(), "other", "x")));
  await assertFails(setDoc(doc(db(), "other", "y"), { a: 1 }));
  await assertFails(getDocs(collection(db(), "expenses")));
  await assertFails(getDocs(collection(db(), "groups", GROUP, "settlements")));
  await assertFails(setDoc(doc(db(), "groups", GROUP, "settlements", "s1"), { amount: 1 }));
  await assertFails(getDocs(collection(db(), "groups", GROUP, "people", "asha", "notes")));
  await assertFails(setDoc(doc(db(), "groups", GROUP, "people", "asha", "notes", "n"), { a: 1 }));
});
