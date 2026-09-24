// Recrea la base de datos de test desde cero aplicando las migraciones
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

require('./env');

const root = path.join(__dirname, '..', '..');
for (const file of ['test.db', 'test.db-journal']) {
  fs.rmSync(path.join(root, file), { force: true });
}

execSync('npx prisma migrate deploy', { cwd: root, env: process.env, stdio: 'ignore' });
