import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { migrate } from './migrations.js';

export type Db = Database.Database;

const SCHEMA_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');

/**
 * Open a database and bring its schema up to date.
 *
 * Two steps, in this order: `schema.sql` builds the current shape (a no-op
 * when it already exists), then `migrate` carries any older file forward.
 * Migrating first would find no destination table to move rows into.
 *
 * Pass `":memory:"` for an isolated database — that is what the tests do.
 */
export function openDatabase(filename: string): Db {
  const inMemory = filename === ':memory:';

  if (!inMemory) {
    mkdirSync(path.dirname(filename), { recursive: true });
  }

  const db = new Database(filename);

  if (!inMemory) {
    db.pragma('journal_mode = WAL');
  }
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync(SCHEMA_PATH, 'utf8'));
  migrate(db);

  return db;
}
