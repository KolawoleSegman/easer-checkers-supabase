import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { DDL } from './ddl';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    '\n❌ DATABASE_URL is not set.\n   Use your Supabase connection string: Connect → Session pooler (see SUPABASE_SETUP.md).\n',
  );
  process.exit(1);
}

const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connectionString);
const useSsl =
  process.env.DATABASE_SSL === 'false' ? false : process.env.DATABASE_SSL === 'true' || !isLocal;

export const pool = new Pool({
  connectionString,
  // Supabase requires TLS. (Pass the CA from Supabase and set
  // rejectUnauthorized: true if you want strict certificate checking.)
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// An idle client erroring (e.g. Supabase restarting) must not crash the server.
pool.on('error', (err) => console.error('Postgres pool error:', err.message));

export const db = drizzle(pool, { schema });

/** Creates missing tables/indexes. Safe to run on every boot. */
export async function initDb(): Promise<void> {
  const client = await pool.connect();
  try {
    // Advisory lock so two instances booting together don't race on DDL.
    await client.query('SELECT pg_advisory_lock(727274)');
    await client.query(DDL);
    await client.query('SELECT pg_advisory_unlock(727274)');
  } finally {
    client.release();
  }
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
