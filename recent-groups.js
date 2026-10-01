// The groups opened on this phone (SF-029), for "Your groups" on the welcome screen, and the
// short dates the page writes. Kept only on this device, in localStorage under RECENT_KEY, as
// JSON: [{ code, openedAt, invite? }], most recent first. The server never sees the list.
// Pure functions with no imports, so the page loads this as "./recent-groups.js?v=N"; the caller
// passes group-code.js's isValidGroupId.

export const RECENT_KEY = "splitfamilia-recent";
export const MAX_RECENT = 20;

// The stored text → a clean list: each entry with a valid code and an opening time (ms), each
// code once (the first, most recent, wins), at most MAX_RECENT. Anything unreadable gives [].
// `invite: true` marks a group started on this phone whose guide still offers "Invite your group".
export function readRecent(text, isValid){
  let raw;
  try{ raw = JSON.parse(text); }catch(e){ return []; }
  if(!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  raw.forEach(function(e){
    if(out.length >= MAX_RECENT) return;
    if(e === null || typeof e !== "object" || !isValid(e.code) || seen.has(e.code)) return;
    if(!Number.isSafeInteger(e.openedAt) || e.openedAt < 0) return;
    seen.add(e.code);
    out.push(entry(e.code, e.openedAt, e.invite === true));
  });
  return out;
}

function entry(code, openedAt, invite){
  return invite ? { code: code, openedAt: openedAt, invite: true } : { code: code, openedAt: openedAt };
}

// → a new list with `code` at the top, opened at `now`, with no other copy of it, and the oldest
// dropped past MAX_RECENT. `startedHere` marks a group started on this phone (see readRecent); a
// group keeps the mark until inviteDone. An invalid code leaves the list as it was.
export function rememberGroup(list, code, now, isValid, startedHere){
  if(!isValid(code)) return list.slice();
  const old = list.find(function(e){ return e.code === code; });
  const invite = startedHere === true || Boolean(old && old.invite === true);
  return [entry(code, now, invite)].concat(list.filter(function(e){ return e.code !== code; })).slice(0, MAX_RECENT);
}

// "Remove from this device": the list without `code`, the rest in order. The group itself, on
// the server, is untouched, and its invite link still works.
export function forgetGroup(list, code){
  return list.filter(function(e){ return e.code !== code; });
}

// Does the guide still offer "Invite your group" for `code`?
export function wantsInvite(list, code){
  return list.some(function(e){ return e.code === code && e.invite === true; });
}

// After "Copy invite link" or "Not now": the guide stops offering it.
export function inviteDone(list, code){
  return list.map(function(e){ return e.code === code ? entry(e.code, e.openedAt, false) : e; });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A day as the ledger shows it, in the phone's time zone: "29 Sep", with the year when it isn't
// this year: "30 Dec 2025". `when` is a time in ms or an ISO text; `now` in ms.
export function shortDate(when, now){
  const d = new Date(when);
  const text = d.getDate() + " " + MONTHS[d.getMonth()];
  return d.getFullYear() === new Date(now).getFullYear() ? text : text + " " + d.getFullYear();
}

function plural(n, word){ return n + " " + word + (n === 1 ? "" : "s"); }

function dayStart(ms){
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// When a group was last opened, for "Opened …": "just now", "5 minutes ago", "3 hours ago" (the
// same day), "yesterday", or "on 12 Aug" ("on 12 Aug 2025" in another year).
export function openedText(openedAt, now){
  const ago = now - openedAt;
  if(ago < 60 * 1000) return "just now";
  if(ago < 60 * 60 * 1000) return plural(Math.floor(ago / 60000), "minute") + " ago";
  const today = dayStart(now);
  if(openedAt >= today) return plural(Math.floor(ago / 3600000), "hour") + " ago";
  // The day before today, whatever its length (a clock change can make it 23 or 25 hours).
  const yesterday = dayStart(today - 1);
  if(openedAt >= yesterday) return "yesterday";
  return "on " + shortDate(openedAt, now);
}
