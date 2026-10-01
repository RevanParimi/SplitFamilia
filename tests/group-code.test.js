// Tests for group-code.js: valid group codes (SF-005), new unguessable codes and invite links
// (SF-006). Expected values are worked out by hand in the comments.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isValidGroupId, MAX_GROUP_ID_LENGTH, slugify, CODE_ALPHABET, CODE_LENGTH, randomCode, newGroupId, parseInvite, movedLink, HOME,
  groupName
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

test("invite parsing: a link pasted from a sentence keeps its code (the T-02 review's N-1)", function(){
  const code = "goa-trip-7k2m9xqpwd";
  const link = "https://splitfamilia.up.railway.app/?g=" + code;
  for(const text of [link + ".", link + ",", link + ")", "(" + link + ")", "(" + link + ").", "\"" + link + "\"", "<" + link + ">",
    "“" + link + "”", link + "!", link + "?", code + ".", "(" + code + ")", "'" + code + "'"]){
    assert.equal(parseInvite(text), code, text);
  }
  // Only what's around it: a code's own hyphens and letters are kept, and nothing else changes.
  assert.equal(parseInvite("Goa Trip 2026."), "goa-trip-2026");
  assert.equal(parseInvite("https://host/?g=goa-trip-2026&x=1)"), "goa-trip-2026");
  ["(", ".", "\"\"", "()."].forEach(function(text){ assert.equal(parseInvite(text), null, text); });
});

test("a group's name comes from its code, without the random part (SF-028)", function(){
  assert.equal(groupName("goa-trip-7k2m9xqpwd"), "Goa trip");
  assert.equal(groupName(newGroupId("Diwali party 2026", fixedBytes(BYTES))), "Diwali party 2026");
  assert.equal(groupName("goa-trip-2026"), "Goa trip 2026"); // an old code: its last part is a year
  assert.equal(groupName("group-" + BYTES_CODE), "Group"); // a name with no usable letters
  assert.equal(groupName("family"), "Family");
  // A code that is only a random-looking part keeps it.
  assert.equal(groupName("abcdefghij"), "Abcdefghij");
  // A last part of 10 with a letter outside the alphabet (l, o, 0 or 1) isn't random.
  assert.equal(groupName("trip-to-goa-olympiad12"), "Trip to goa olympiad12");
  assert.equal(groupName("trip-lonavala1"), "Trip lonavala1");
});

// ---------- the old address (SF-038) ----------

test("on GitHub Pages the page points to the Railway address, keeping the group", function(){
  assert.equal(HOME, "https://splitfamilia.up.railway.app/");
  const pages = "https://revanparimi.github.io/SplitFamilia/";
  assert.equal(movedLink(pages + "?g=goa-trip-2026", null), "https://splitfamilia.up.railway.app/?g=goa-trip-2026");
  assert.equal(movedLink(pages + "index.html?g=goa-trip-7k2m9xqpwd", "other-trip"), "https://splitfamilia.up.railway.app/?g=goa-trip-7k2m9xqpwd");
  // No code in the link: the group saved on this phone; none at all: the start screen.
  assert.equal(movedLink(pages, "goa-trip-2026"), "https://splitfamilia.up.railway.app/?g=goa-trip-2026");
  assert.equal(movedLink(pages, null), "https://splitfamilia.up.railway.app/");
  // A bad code in the link isn't carried over (the saved one is, if valid).
  assert.equal(movedLink(pages + "?g=Goa%20Trip", null), "https://splitfamilia.up.railway.app/");
  assert.equal(movedLink(pages + "?g=Goa%20Trip", "goa-trip-2026"), "https://splitfamilia.up.railway.app/?g=goa-trip-2026");
  assert.equal(movedLink(pages, "not a code"), "https://splitfamilia.up.railway.app/");
});

test("on the Railway address, localhost and any other host, the page just runs", function(){
  for(const href of [
    "https://splitfamilia.up.railway.app/?g=goa-trip-2026",
    "http://localhost:8080/?g=goa-trip-2026",
    "http://127.0.0.1:8000/index.html",
    "https://example.com/?g=goa-trip-2026",
    "https://github.io.example.com/",
    "https://notgithub.io/",
    "not a url"
  ]){
    assert.equal(movedLink(href, "goa-trip-2026"), null, href);
  }
});
