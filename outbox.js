// The phone's copy of its group and its changes waiting to sync (SF-036). Every change made on
// the phone gets its ID on the phone and waits in an outbox, in order, until the server confirms
// it. Sending one twice is harmless: the server ignores an ID it already has, and a delete of
// something already gone still succeeds. No imports, so the page loads it with one ?v=.
//
// The outbox logic is pure: it takes a store and a send function, so npm test runs it with a
// fake store and a fake network. openBrowserStore() keeps the same data in IndexedDB.

// What an answer means for a waiting change:
// - "confirmed": 2xx, the server has it (or already had it);
// - "refused": 4xx (400 not ledger-shaped, 404 no such group, 409 in use or full): sending it
//   again won't help, so it is dropped with one plain message;
// - "retry": no connection (0), 408, 429 (too many changes for now) and 5xx (the server restarting
//   or busy): it stays, in its place, and is sent again later.
export function outcome(status){
  if(status >= 200 && status < 300) return "confirmed";
  if(status >= 400 && status < 500 && status !== 408 && status !== 429) return "refused";
  return "retry";
}

// A group as the page shows it: { currency, version, people: [{ id, name }], expenses: [{ id,
// date, desc, amountPaise, paidBy, split }] }. applyChange returns a new group with one change
// made, as the server would make it: an ID already there is left as it is, and deleting what
// isn't there changes nothing. `mark` is copied onto a row the change adds (the page marks rows
// that are still waiting).
export function applyChange(group, change, mark){
  const out = { currency: group.currency, version: group.version, people: group.people.slice(), expenses: group.expenses.slice() };
  const has = function(list, id){ return list.some(function(x){ return x.id === id; }); };
  switch(change.kind){
    case "group":
      out.currency = change.currency;
      break;
    case "person":
      if(!has(out.people, change.id)) out.people.push(Object.assign({ id: change.id, name: change.name }, mark));
      break;
    case "person-delete":
      out.people = out.people.filter(function(p){ return p.id !== change.id; });
      break;
    case "expense":
      if(!has(out.expenses, change.id)){
        out.expenses.push(Object.assign({
          id: change.id, date: change.date, desc: change.desc, amountPaise: change.amountPaise,
          paidBy: change.paidBy, split: change.split.slice()
        }, mark));
      }
      break;
    case "expense-delete":
      out.expenses = out.expenses.filter(function(e){ return e.id !== change.id; });
      break;
  }
  return out;
}

export const EMPTY_GROUP = Object.freeze({ currency: "₹", version: 0, people: [], expenses: [] });

// What the page shows for group `code`: the phone's copy of the server's group (or an empty one),
// with this group's waiting changes made on top, in order. Rows the server doesn't have yet carry
// `waiting: true`.
export function overlay(group, changes, code){
  let view = group || EMPTY_GROUP;
  changes.forEach(function(c){ if(c.code === code) view = applyChange(view, c, { waiting: true }); });
  return view;
}

// The group's expenses in the form money.js reads: `amount` in rupees. money.js turns it back
// into paise with Math.round(amount × 100), which gives back exactly amountPaise for every amount
// allowed (npm test checks).
export function forBalances(expenses){
  return expenses.map(function(e){ return Object.assign({}, e, { amount: e.amountPaise / 100 }); });
}

// The outbox. options:
// - store: { loadOutbox() → [change with its key], add(change) → key, remove(key) } (see
//   memoryStore and openBrowserStore);
// - send(change) → { status, body, retryAfter } (ledger-client.js sendChange; status 0 when the
//   server couldn't be reached);
// - onConfirmed(change, body), onRefused(change, body), onChange(): what the page does then;
// - lock(fn) → a promise of fn(): runs fn with no other tab of this app sending at the same time
//   (the page passes navigator.locks when the browser has it).
export function createOutbox(options){
  const store = options.store;
  const send = options.send;
  const onConfirmed = options.onConfirmed || function(){};
  const onRefused = options.onRefused || function(){};
  const onChange = options.onChange || function(){};
  const lock = options.lock || function(fn){ return fn(); };
  let waiting = []; // the store's changes, oldest first
  let running = null;
  let again = false;

  function sortByKey(list){ return list.slice().sort(function(a, b){ return a.key - b.key; }); }

  // Sends every waiting change, oldest first, and stops at the first one that must wait.
  // → { state: "done" } or { state: "wait", retryAfter (seconds, 0 when the server didn't say) }.
  async function sendAll(){
    waiting = sortByKey(await store.loadOutbox()); // another tab may have sent some
    onChange();
    for(const change of waiting.slice()){
      let res;
      try{ res = await send(change); }catch(e){ res = { status: 0, body: null, retryAfter: 0 }; }
      const result = outcome(res.status);
      if(result === "retry") return { state: "wait", retryAfter: res.retryAfter || 0 };
      await store.remove(change.key);
      waiting = waiting.filter(function(c){ return c.key !== change.key; });
      if(result === "confirmed") onConfirmed(change, res.body);
      else onRefused(change, res.body);
      onChange();
    }
    return { state: "done" };
  }

  // One send at a time. A flush asked for while one runs runs once more after it, so a change
  // added meanwhile isn't left waiting.
  function flush(){
    if(running){
      again = true;
      return running;
    }
    running = (async function(){
      try{
        let result;
        do{
          again = false;
          result = await lock(sendAll);
        }while(again && result.state === "done");
        return result;
      }catch(e){
        // The phone's storage failed: nothing was lost from it, so try again later.
        return { state: "wait", retryAfter: 0 };
      }finally{
        running = null;
      }
    })();
    return running;
  }

  return {
    // Loads what waited when the page was last closed.
    load: async function(){
      waiting = sortByKey(await store.loadOutbox());
      onChange();
    },
    // Keeps a change on the phone. The caller then flushes (the page does at once), so a change
    // is never sent before it is safely kept.
    add: async function(change){
      const key = await store.add(change);
      waiting.push(Object.assign({}, change, { key: key }));
      onChange();
    },
    flush: flush,
    // The changes waiting for group `code` (or all), oldest first. Deletes count like any change.
    changes: function(code){
      return code === undefined ? waiting.slice() : waiting.filter(function(c){ return c.code === code; });
    },
    count: function(code){
      return code === undefined ? waiting.length : waiting.filter(function(c){ return c.code === code; }).length;
    }
  };
}

// A store in memory: for tests, and for a browser without IndexedDB (then nothing outlives the tab).
export function memoryStore(){
  let next = 1;
  const outbox = new Map();
  const copies = new Map();
  const clone = function(v){ return JSON.parse(JSON.stringify(v)); };
  return {
    loadOutbox: async function(){ return Array.from(outbox.values()).map(clone); },
    add: async function(change){
      const key = next++;
      outbox.set(key, clone(Object.assign({}, change, { key: key })));
      return key;
    },
    remove: async function(key){ outbox.delete(key); },
    getCopy: async function(code){ return copies.has(code) ? clone(copies.get(code)) : null; },
    putCopy: async function(code, group){ copies.set(code, clone(group)); }
  };
}

// The same store in the browser's IndexedDB, so the copy and the outbox outlive the page. The
// group code is a key inside the phone's storage, never part of a URL. → a promise of the store,
// or of null when IndexedDB can't be opened (for example in some private windows).
export function openBrowserStore(idb){
  return new Promise(function(resolve){
    let req;
    try{ req = idb.open("splitfamilia", 1); }catch(e){ return resolve(null); }
    req.onupgradeneeded = function(){
      const db = req.result;
      db.createObjectStore("outbox", { keyPath: "key", autoIncrement: true });
      db.createObjectStore("copies", { keyPath: "code" });
    };
    req.onerror = function(){ resolve(null); };
    req.onblocked = function(){ resolve(null); };
    req.onsuccess = function(){ resolve(wrap(req.result)); };
  });

  function wrap(db){
    function run(name, mode, fn){
      return new Promise(function(resolve, reject){
        const tx = db.transaction(name, mode);
        const r = fn(tx.objectStore(name));
        tx.oncomplete = function(){ resolve(r ? r.result : undefined); };
        tx.onerror = function(){ reject(tx.error); };
        tx.onabort = function(){ reject(tx.error); };
      });
    }
    return {
      loadOutbox: function(){ return run("outbox", "readonly", function(s){ return s.getAll(); }).then(function(v){ return v || []; }); },
      add: function(change){
        const entry = Object.assign({}, change);
        delete entry.key;
        return run("outbox", "readwrite", function(s){ return s.add(entry); });
      },
      remove: function(key){ return run("outbox", "readwrite", function(s){ s.delete(key); }); },
      getCopy: function(code){
        return run("copies", "readonly", function(s){ return s.get(code); }).then(function(v){ return v ? v.group : null; });
      },
      putCopy: function(code, group){ return run("copies", "readwrite", function(s){ s.put({ code: code, group: group }); }); }
    };
  }
}
