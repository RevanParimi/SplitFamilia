// The ledger's database (SF-032): one SQLite file through Node's built-in node:sqlite, on a
// Railway volume in production. Money is stored as whole paise (₹100.00 is 10000), never as a
// decimal. Every query uses bound parameters.
//
// Changes are never overwritten: a person or an expense is added once under its ID, and a delete
// only marks it deleted. So sending the same change twice (an offline phone retrying, SF-036)
// adds nothing, even after someone else has deleted that row.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const DB_FILE_NAME = "splitfamilia.db";

// Railway's volume when one is attached, otherwise data/ next to the app (git-ignored).
export function dataDir(env){
  return env.RAILWAY_VOLUME_MOUNT_PATH || fileURLToPath(new URL("../data/", import.meta.url));
}

// Numbered migrations: each runs once, in order, and schema_version records how many have run.
// Never edit one that has shipped; add the next.
const MIGRATIONS = [
  // 1. Groups, people, expenses, and the people each expense is split among, in order. The split
  // is a table, not a JSON column, so "is this person in any expense?" is a plain query. Payers
  // and split members have no foreign key to people: someone removed while another phone was
  // adding an expense keeps their share under their old ID (see money.js).
  `CREATE TABLE groups (
     code TEXT PRIMARY KEY,
     currency TEXT NOT NULL,
     version INTEGER NOT NULL,
     created_at TEXT NOT NULL
   ) STRICT;
   CREATE TABLE people (
     group_code TEXT NOT NULL REFERENCES groups(code) ON DELETE CASCADE,
     id TEXT NOT NULL,
     name TEXT NOT NULL,
     created_at TEXT NOT NULL,
     deleted_at TEXT,
     PRIMARY KEY (group_code, id)
   ) STRICT;
   CREATE TABLE expenses (
     group_code TEXT NOT NULL REFERENCES groups(code) ON DELETE CASCADE,
     id TEXT NOT NULL,
     date TEXT NOT NULL,
     description TEXT NOT NULL,
     amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
     paid_by TEXT NOT NULL,
     created_at TEXT NOT NULL,
     deleted_at TEXT,
     PRIMARY KEY (group_code, id)
   ) STRICT;
   CREATE TABLE expense_split (
     group_code TEXT NOT NULL,
     expense_id TEXT NOT NULL,
     position INTEGER NOT NULL,
     person_id TEXT NOT NULL,
     PRIMARY KEY (group_code, expense_id, position),
     FOREIGN KEY (group_code, expense_id) REFERENCES expenses(group_code, id) ON DELETE CASCADE
   ) STRICT;`
];
export const SCHEMA_VERSION = MIGRATIONS.length;

function migrate(db){
  db.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL) STRICT");
  const row = db.prepare("SELECT version FROM schema_version").get();
  if(!row) db.prepare("INSERT INTO schema_version (version) VALUES (0)").run();
  let current = row ? row.version : 0;
  const setVersion = db.prepare("UPDATE schema_version SET version = ?");
  while(current < MIGRATIONS.length){
    inTransaction(db, function(){
      db.exec(MIGRATIONS[current]);
      setVersion.run(current + 1);
    });
    current++;
  }
}

function inTransaction(db, fn){
  db.exec("BEGIN IMMEDIATE");
  try{
    const result = fn();
    db.exec("COMMIT");
    return result;
  }catch(err){
    db.exec("ROLLBACK");
    throw err;
  }
}

// Opens (and creates, if needed) the database file. Throws if it can't: the caller keeps serving
// the page and answers the API with 503 (SF-032).
export function openLedger(file, options){
  const now = (options && options.now) || function(){ return new Date().toISOString(); };
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  try{
    db.exec("PRAGMA busy_timeout = 5000");
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    migrate(db);
  }catch(err){
    db.close();
    throw err;
  }
  let open = true;

  const q = {
    group: db.prepare("SELECT currency, version FROM groups WHERE code = ?"),
    createGroup: db.prepare("INSERT INTO groups (code, currency, version, created_at) VALUES (?, ?, 1, ?)"),
    setCurrency: db.prepare("UPDATE groups SET currency = ?, version = version + 1 WHERE code = ? RETURNING version"),
    bump: db.prepare("UPDATE groups SET version = version + 1 WHERE code = ? RETURNING version"),
    people: db.prepare("SELECT id, name FROM people WHERE group_code = ? AND deleted_at IS NULL ORDER BY rowid"),
    addPerson: db.prepare(
      "INSERT INTO people (group_code, id, name, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (group_code, id) DO NOTHING"
    ),
    personExists: db.prepare("SELECT 1 AS found FROM people WHERE group_code = ? AND id = ?"),
    deletePerson: db.prepare("UPDATE people SET deleted_at = ? WHERE group_code = ? AND id = ? AND deleted_at IS NULL"),
    personInUse: db.prepare(
      "SELECT 1 AS used FROM expenses e WHERE e.group_code = ? AND e.deleted_at IS NULL AND (e.paid_by = ? OR EXISTS " +
      "(SELECT 1 FROM expense_split s WHERE s.group_code = e.group_code AND s.expense_id = e.id AND s.person_id = ?)) LIMIT 1"
    ),
    expenses: db.prepare(
      "SELECT id, date, description, amount_paise, paid_by FROM expenses WHERE group_code = ? AND deleted_at IS NULL ORDER BY rowid"
    ),
    splits: db.prepare(
      "SELECT s.expense_id, s.person_id FROM expense_split s JOIN expenses e ON e.group_code = s.group_code AND e.id = s.expense_id " +
      "WHERE s.group_code = ? AND e.deleted_at IS NULL ORDER BY s.expense_id, s.position"
    ),
    addExpense: db.prepare(
      "INSERT INTO expenses (group_code, id, date, description, amount_paise, paid_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT (group_code, id) DO NOTHING"
    ),
    expenseExists: db.prepare("SELECT 1 AS found FROM expenses WHERE group_code = ? AND id = ?"),
    expenseCount: db.prepare("SELECT COUNT(*) AS n FROM expenses WHERE group_code = ?"),
    splitEntryCount: db.prepare("SELECT COUNT(*) AS n FROM expense_split WHERE group_code = ?"),
    addSplit: db.prepare("INSERT INTO expense_split (group_code, expense_id, position, person_id) VALUES (?, ?, ?, ?)"),
    deleteExpense: db.prepare("UPDATE expenses SET deleted_at = ? WHERE group_code = ? AND id = ? AND deleted_at IS NULL")
  };

  // The group's version: 1 when it is created, and one more after each change. null when there is
  // no such group.
  function groupVersion(code){
    const row = q.group.get(code);
    return row ? row.version : null;
  }

  return {
    groupVersion: groupVersion,

    // Everything the page shows: { currency, version, people: [{ id, name }], expenses: [{ id,
    // date, desc, amountPaise, paidBy, split }] }, in the order they were added. null when there
    // is no such group.
    readGroup: function(code){
      const group = q.group.get(code);
      if(!group) return null;
      const splits = new Map();
      q.splits.all(code).forEach(function(s){
        if(!splits.has(s.expense_id)) splits.set(s.expense_id, []);
        splits.get(s.expense_id).push(s.person_id);
      });
      return {
        currency: group.currency,
        version: group.version,
        people: q.people.all(code).map(function(p){ return { id: p.id, name: p.name }; }),
        expenses: q.expenses.all(code).map(function(e){
          return {
            id: e.id, date: e.date, desc: e.description, amountPaise: e.amount_paise,
            paidBy: e.paid_by, split: splits.get(e.id) || []
          };
        })
      };
    },

    // The IDs of the group's people (not deleted), for checking a payer and a split.
    personIds: function(code){
      return new Set(q.people.all(code).map(function(p){ return p.id; }));
    },

    // Sets the currency, creating the group if there is none. → { created, version }
    setCurrency: function(code, currency){
      return inTransaction(db, function(){
        if(groupVersion(code) === null){
          q.createGroup.run(code, currency, now());
          return { created: true, version: 1 };
        }
        return { created: false, version: q.setCurrency.get(currency, code).version };
      });
    },

    // → { added, version }. added is false when the ID is already there, even if deleted.
    addPerson: function(code, person){
      return inTransaction(db, function(){
        const added = q.addPerson.run(code, person.id, person.name, now()).changes === 1;
        return { added: added, version: added ? q.bump.get(code).version : groupVersion(code) };
      });
    },

    // Is there a person with this ID, deleted or not?
    personExists: function(code, id){
      return q.personExists.get(code, id) !== undefined;
    },

    // Is this person the payer of, or in the split of, any expense that isn't deleted?
    personInUse: function(code, id){
      return q.personInUse.get(code, id, id) !== undefined;
    },

    // → { deleted, version }. deleted is false when there was no such person, or they were already
    // deleted. The caller checks personInUse first.
    deletePerson: function(code, id){
      return inTransaction(db, function(){
        const deleted = q.deletePerson.run(now(), code, id).changes === 1;
        return { deleted: deleted, version: deleted ? q.bump.get(code).version : groupVersion(code) };
      });
    },

    // Is there an expense with this ID, deleted or not?
    expenseExists: function(code, id){
      return q.expenseExists.get(code, id) !== undefined;
    },

    // How many expenses the group has ever had, deleted ones included (for MAX_EXPENSES).
    expenseCount: function(code){
      return q.expenseCount.get(code).n;
    },

    // How many split entries the group's expenses have, deleted ones included (for MAX_SPLIT_ENTRIES).
    splitEntryCount: function(code){
      return q.splitEntryCount.get(code).n;
    },

    // → { added, version }, as addPerson. The amount is whole paise.
    addExpense: function(code, expense){
      return inTransaction(db, function(){
        const added = q.addExpense.run(
          code, expense.id, expense.date, expense.desc, expense.amountPaise, expense.paidBy, now()
        ).changes === 1;
        if(!added) return { added: false, version: groupVersion(code) };
        expense.split.forEach(function(personId, i){ q.addSplit.run(code, expense.id, i, personId); });
        return { added: true, version: q.bump.get(code).version };
      });
    },

    // A whole group copied in at once (SF-037): created if new, with each person and expense
    // added under its own ID, and an ID already here left as it is, so running the copy again
    // adds nothing. One version step for the lot. → { created, version, added: { people, expenses } }
    importGroup: function(code, group){
      return inTransaction(db, function(){
        const created = groupVersion(code) === null;
        if(created) q.createGroup.run(code, group.currency, now());
        let people = 0;
        let expenses = 0;
        group.people.forEach(function(p){
          if(q.addPerson.run(code, p.id, p.name, now()).changes === 1) people++;
        });
        group.expenses.forEach(function(e){
          if(q.addExpense.run(code, e.id, e.date, e.desc, e.amountPaise, e.paidBy, now()).changes !== 1) return;
          e.split.forEach(function(personId, i){ q.addSplit.run(code, e.id, i, personId); });
          expenses++;
        });
        const version = !created && (people > 0 || expenses > 0) ? q.bump.get(code).version : groupVersion(code);
        return { created: created, version: version, added: { people: people, expenses: expenses } };
      });
    },

    // → { deleted, version }, as deletePerson.
    deleteExpense: function(code, id){
      return inTransaction(db, function(){
        const deleted = q.deleteExpense.run(now(), code, id).changes === 1;
        return { deleted: deleted, version: deleted ? q.bump.get(code).version : groupVersion(code) };
      });
    },

    // For tests: runs one statement with bound parameters and returns its rows.
    query: function(sql, params){
      return db.prepare(sql).all(...(params || []));
    },

    close: function(){
      if(open) db.close();
      open = false;
    }
  };
}
