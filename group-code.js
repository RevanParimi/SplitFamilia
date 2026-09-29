// Group codes: checking them, making new ones and reading invite links. Pure functions: no DOM,
// no Firebase, so `npm test` can check them without the network.
//
// A group code is the Firestore document ID under groups/, and anyone who knows it can open the
// group, so new codes end in a random part that strangers can't guess.

// Lowercase letters and digits in runs joined by single hyphens, at most 80 characters, with no
// hyphen at either end. Every code slugify() or newGroupId() makes fits, and so must the
// Firestore rules (SF-007).
const GROUP_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_GROUP_ID_LENGTH = 80;

export function isValidGroupId(value){
  return typeof value === "string" && value.length <= MAX_GROUP_ID_LENGTH && GROUP_ID_PATTERN.test(value);
}

// A group name as a code: "Goa Trip 2026!" → "goa-trip-2026". The same rule the app has always
// used, so old groups can still be joined by typing their name. It also trims a hyphen left at
// the end by the 60-character cut, which the old rule kept.
export function slugify(raw){
  return String(raw).trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 60).replace(/-+$/, "");
}

// 32 characters: a–z and 2–9 without l, o, 0 and 1, which are easy to misread. 256 is a
// multiple of 32, so `byte & 31` picks each one equally often.
export const CODE_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
export const CODE_LENGTH = 10; // 10 characters × 5 bits = 50 bits

function fillFromCrypto(bytes){ crypto.getRandomValues(bytes); }

// `fillRandom(bytes)` fills a Uint8Array; tests pass a fixed one. Never Math.random.
export function randomCode(length, fillRandom){
  const bytes = new Uint8Array(length);
  (fillRandom || fillFromCrypto)(bytes);
  let code = "";
  for(let i = 0; i < length; i++) code += CODE_ALPHABET[bytes[i] & 31];
  return code;
}

// A new group's code: "goa trip" → "goa-trip-7k2m9xqpwd". A name with no usable letters, such
// as "गोवा", starts with "group" instead.
export function newGroupId(name, fillRandom){
  return (slugify(name) || "group") + "-" + randomCode(CODE_LENGTH, fillRandom);
}

// What someone typed or pasted under "Join": an invite link (its `g`), a code, or an old group's
// name. Returns the group code, or null when it can't be one.
// A link's `g` must already be a valid code: "?g=GOA" is refused, not lower-cased, because
// lower-casing would quietly open a different group. Typed text is lower-cased and, if it still
// isn't a code, turned into one the way old groups were named ("Goa Trip 2026" → "goa-trip-2026").
export function parseInvite(text){
  const raw = String(text).trim();
  if(raw === "") return null;
  if(raw.indexOf("://") !== -1 || /[?&]g=/.test(raw)){
    let url;
    try{ url = new URL(raw, "https://invite.invalid/"); }catch(e){ return null; }
    const g = url.searchParams.get("g");
    return isValidGroupId(g) ? g : null;
  }
  const lower = raw.toLowerCase();
  if(isValidGroupId(lower)) return lower;
  const slug = slugify(raw);
  return slug === "" ? null : slug;
}
