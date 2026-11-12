import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from './app.js';
import { openDatabase } from './db/index.js';
import { createTransactionRepository } from './repositories/transaction-repository.js';
import { createTransactionService } from './services/transaction-service.js';

const here = path.dirname(fileURLToPath(import.meta.url));

const port = Number(process.env['PORT'] ?? 3000);
const databasePath =
  process.env['DATABASE_PATH'] ?? path.join(here, '..', 'data', 'expenses.sqlite');

const db = openDatabase(databasePath);
const service = createTransactionService(createTransactionRepository(db));

createApp(service).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`Database: ${databasePath}`);
});
