// One-off: copy an existing SQLite database (old Easer Checkers) into Postgres.
//   DATABASE_URL=postgres://... npm run db:import-sqlite -- ./data/easer_checker.db
// Safe to re-run: rows that already exist are skipped. Creates the tables if needed.
const path = require('path');
const Database = require('better-sqlite3');
const { Pool } = require('pg');
const { DDL } = require('../dist/src/db/ddl.js');

const file = path.resolve(process.argv[2] || path.join(process.env.DATA_DIR || 'data', 'easer_checker.db'));
const url = process.env.DATABASE_URL;
if (!url) { console.error('Set DATABASE_URL first.'); process.exit(1); }
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const pool = new Pool({ connectionString: url, ssl: local ? undefined : { rejectUnauthorized: false } });
const lite = new Database(file, { readonly: true, fileMustExist: true });

// SQLite stored timestamps either as epoch seconds (drizzle) or as the text
// "YYYY-MM-DD HH:MM:SS" (column default). Accept both.
const ts = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return new Date(v > 1e11 ? v : v * 1000);
  const d = new Date(/z|\+/i.test(v) ? v : String(v).replace(' ', 'T') + 'Z');
  return isNaN(d) ? null : d;
};
const bool = (v) => (v === null || v === undefined ? null : !!v);

// table -> converters, in foreign-key order
const plan = [
  ['users', { created_at: ts, updated_at: ts }],
  ['games', { started_at: ts, ended_at: ts }],
  ['moves', { created_at: ts, promoted_to_king: bool }],
  ['statistics', {}],
  ['friendships', { created_at: ts }],
  ['notifications', { created_at: ts, read: bool }],
  ['tournaments', { started_at: ts, ended_at: ts, created_at: ts }],
  ['tournament_players', { created_at: ts }],
  ['tournament_matches', { created_at: ts }],
];

(async () => {
  await pool.query(DDL);
  const have = new Set(lite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name));
  for (const [table, conv] of plan) {
    if (!have.has(table)) { console.log(`${table}: not in SQLite, skipped`); continue; }
    const rows = lite.prepare(`SELECT * FROM ${table}`).all();
    let inserted = 0, failed = 0;
    for (const row of rows) {
      const cols = Object.keys(row);
      const vals = cols.map((c) => (conv[c] ? conv[c](row[c]) : row[c]));
      try {
        const r = await pool.query(
          `INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}) ON CONFLICT DO NOTHING`,
          vals,
        );
        inserted += r.rowCount;
      } catch (e) {
        failed++;
        console.warn(`  ${table} row ${row.id}: ${e.message}`);
      }
    }
    console.log(`${table}: ${inserted} inserted, ${rows.length - inserted - failed} already there, ${failed} failed`);
  }
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
