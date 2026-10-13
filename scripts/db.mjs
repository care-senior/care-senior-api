import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import pg from 'pg';

const DB_DIR = resolve(import.meta.dirname, '../db');

function createClient() {
  return new pg.Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
}

async function listFiles(directory, extension) {
  const files = await readdir(join(DB_DIR, directory));
  return files.filter((file) => file.endsWith(extension)).sort();
}

async function migrate(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name varchar PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const { rows } = await client.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((row) => row.name));
  const pending = (await listFiles('migrations', '.sql')).filter(
    (file) => !applied.has(file),
  );

  for (const file of pending) {
    const sql = await readFile(join(DB_DIR, 'migrations', file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [
        file,
      ]);
      await client.query('COMMIT');
      console.log(`applied ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`${file}: ${error.message}`);
    }
  }

  if (pending.length === 0) console.log('database is up to date');
}

const commands = { migrate };
const command = commands[process.argv[2]];

if (!command) {
  console.error(
    `usage: node scripts/db.mjs <${Object.keys(commands).join('|')}>`,
  );
  process.exit(1);
}

const client = createClient();
try {
  await client.connect();
  await command(client);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
