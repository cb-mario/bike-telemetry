// Recrea la base de datos de test desde cero aplicando las migraciones
const { execSync } = require('node:child_process');
const path = require('node:path');
const { Client } = require('pg');

require('./env');

const root = path.join(__dirname, '..', '..');

async function main() {
  // Salvaguarda: se borra todo, así que solo se acepta una base cuyo nombre acabe en _test
  const database = new URL(process.env.DATABASE_URL).pathname.slice(1);
  if (!database.endsWith('_test')) throw new Error(`La base de test debe acabar en _test (es "${database}")`);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  await client.end();

  execSync('npx prisma migrate deploy', { cwd: root, env: process.env, stdio: 'ignore' });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
