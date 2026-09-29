// Tests for group-code.js: valid group codes (SF-005), new unguessable codes and invite links
// (SF-006). Expected values are worked out by hand in the comments.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isValidGroupId, MAX_GROUP_ID_LENGTH, slugify, CODE_ALPHABET, CODE_LENGTH, randomCode, newGroupId, parseInvite
} from "../group-code.js";

// Fills the bytes from a fixed list, like a stubbed crypto.getRandomValues.
function fixedBytes(list){
  return function(bytes){ list.forEach(function(b, i){ bytes[i] = b; }); };
}
// byte & 31 → 0 a, 31 9, 0 a, 31 9, 8 i, 9 j, 10 k, 4 e, 8 i, 17 t
// (alphabet index: a0 b1 c2 d3 e4 f5 g6 h7 i8 j9 k10 m11 … t17 … 9 is 31).
const BYTES = [0, 31, 32, 255, 8, 9, 10, 100, 200, 17];
const BYTES_CODE = "a9a9ijkeit";

// The app's slugify before T-02 (index.html at 8898b50), kept to prove old names still match.
function oldSlugify(raw){
  return raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// ---------- SF-005: which codes are allowed ----------

test("accepted group codes", function(){
  ["goa-trip-2026", "a", "x1-y2", "goa-trip-7k2m9xqpwd", "a".repeat(80)].forEach(function(id){
    assert.equal(isValidGroupId(id), true, id);
  });
});

test("rejected group codes", function(){
  ["goa/trip", "", "-x", "x-", "a--b", "GOA", "..", "__x__", "a".repeat(81), "goa trip", "goa_trip", "é",
    null, undefined, 5].forEach(function(id){
    assert.equal(isValidGroupId(id), false, String(id));
  });
  assert.equal(MAX_GROUP_ID_LENGTH, 80);
});

test("slugify keeps the old rule, so old groups can be joined by typing their name", function(){
  assert.equal(slugify("Goa Trip 2026!"), "goa-trip-2026");
  assert.equal(slugify("  --Family__Ledger--  "), "family-ledger");
  assert.equal(slugify("गोवा"), "");
  const samples = ["goa-trip-2026", "Diwali 2026 @ Nani's", "a  b", "UPPER lower 123", "!!!", "x".repeat(70),
    "trip—to—Goa", "a".repeat(59) + "!!", "Ünïcödé trip"];
  samples.forEach(function(name){ assert.equal(slugify(name), oldSlugify(name), name); });
});

test("slugify output is always a valid code or empty", function(){
  // The one difference from the old rule: a separator at character 60 left a trailing hyphen.
  const name = "a".repeat(59) + " b";
  assert.equal(oldSlugify(name), "a".repeat(59) + "-");
  assert.equal(slugify(name), "a".repeat(59));
  let seed = 7;
  const next = function(){ seed = (seed * 1103515245 + 12345) % 2147483648; return seed; };
  const chars = "aZ9 -_./!é गो\t";
  for(let k = 0; k < 2000; k++){
    let s = "";
    const len = next() % 90;
    for(let c = 0; c < len; c++) s += chars[next() % chars.length];
    const out = slugify(s);
    assert.ok(out === "" || isValidGroupId(out), JSON.stringify(s) + " → " + out);
  }
});

// ---------- SF-006: new codes ----------

test("the code alphabet has 32 easy-to-read characters", function(){
  assert.equal(CODE_ALPHABET.length, 32);
  assert.equal(new Set(CODE_ALPHABET).size, 32);
  assert.match(CODE_ALPHABET, /^[a-z2-9]+$/);
  ["l", "o", "0", "1"].forEach(function(c){ assert.ok(!CODE_ALPHABET.includes(c), c); });
  assert.equal(CODE_LENGTH, 10); // 10 × 5 bits = 50 bits
});

test("a fixed random source gives a known code", function(){
  assert.equal(randomCode(10, fixedBytes(BYTES)), BYTES_CODE);
  assert.equal(newGroupId("goa trip", fixedBytes(BYTES)), "goa-trip-" + BYTES_CODE);
  assert.equal(newGroupId("गोवा", fixedBytes(BYTES)), "group-" + BYTES_CODE);
});

test("new codes come from crypto, never Math.random", function(){
  const realRandom = Math.random;
  Math.random = function(){ throw new Error("Math.random must not be used"); };
  try{
    const seen = new Set();
    for(let k = 0; k < 2000; k++){
      const id = newGroupId("Goa trip");
      assert.match(id, /^goa-trip-[a-km-np-z2-9]{10}$/);
      assert.ok(isValidGroupId(id), id);
      seen.add(id);
    }
    // 2000 codes out of 2^50: a repeat would mean the source isn't random.
    assert.equal(seen.size, 2000);
  }finally{
    Math.random = realRandom;
  }
});

test("every new code fits the SF-005 pattern, even from long or odd names", function(){
  ["x".repeat(200), "a".repeat(59) + " b", "!!!", "", "  Trip 2026  "].forEach(function(name){
    const id = newGroupId(name);
    assert.ok(isValidGroupId(id), name + " → " + id);
    assert.ok(id.length <= 71, id);
  });
});

// ---------- SF-006: joining with a link or code ----------

test("invite parsing: a full link, a bare code, and a link without a code", function(){
  assert.equal(parseInvite("https://host/index.html?g=goa-trip-7k2m9xqpwd"), "goa-trip-7k2m9xqpwd");
  assert.equal(parseInvite("goa-trip-7k2m9xqpwd"), "goa-trip-7k2m9xqpwd");
  assert.equal(parseInvite("https://host/?x=1"), null);
});

test("invite parsing: other links", function(){
  assert.equal(parseInvite("  http://localhost:8000/?x=1&g=goa-2026  "), "goa-2026");
  assert.equal(parseInvite("splitfamilia.example/?g=goa-trip-7k2m9xqpwd"), "goa-trip-7k2m9xqpwd");
  assert.equal(parseInvite("https://host/?g=goa/trip"), null);
  assert.equal(parseInvite("https://host/?g=goa%2Ftrip"), null);
  assert.equal(parseInvite("https://host/?g=GOA-TRIP"), null);
  assert.equal(parseInvite("https://host/?g="), null);
});

test("invite parsing: typed codes and old group names", function(){
  // Phones capitalise the first letter; codes are lowercase, so typed text is lower-cased.
  assert.equal(parseInvite("Goa-trip-7K2M9XQPWD"), "goa-trip-7k2m9xqpwd");
  assert.equal(parseInvite("  Goa Trip 2026 "), "goa-trip-2026");
  // A long new code (60-character name part + 11) is kept whole, not cut to 60.
  const long = "a".repeat(60) + "-" + BYTES_CODE;
  assert.equal(parseInvite(long), long);
  ["", "   ", "!!!", "गोवा"].forEach(function(text){ assert.equal(parseInvite(text), null, text); });
});
