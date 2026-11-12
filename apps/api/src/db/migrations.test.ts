import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openDatabase } from './index.js';
import { SCHEMA_VERSION } from './migrations.js';

/**
 * The v0 schema, exactly as it shipped: expenses only, four categories, no
 * `kind` column, plus its own index. Copied here rather than imported so that
 * editing `schema.sql` can never quietly change what this test migrates *from*.
 */
const LEGACY_SCHEMA = `
  CREATE TABLE expenses (
    id            TEXT    PRIMARY KEY,
    amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
    category      TEXT    NOT NULL CHECK (category IN ('餐饮', '交通', '购物', '其他')),
    occurred_on   TEXT    NOT NULL,
    note          TEXT,
    recorded_at   TEXT    NOT NULL
  );

  CREATE INDEX idx_expenses_occurred_on ON expenses (occurred_on);
`;

const legacyRow = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  amount_cents: 3800,
  category: '餐饮',
  occurred_on: '2026-10-05',
  note: '午饭 牛肉面',
  recorded_at: '2026-10-05T04:12:00.000Z',
};

describe('openDatabase migration', () => {
  let directory: string;
  let databasePath: string;

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'expense-migrate-'));
    databasePath = path.join(directory, 'expenses.sqlite');
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  /** Writes a v0 file: legacy table, legacy row, no `user_version`. */
  function writeLegacyDatabase(): void {
    const db = new Database(databasePath);
    db.exec(LEGACY_SCHEMA);
    db.prepare(
      `INSERT INTO expenses (id, amount_cents, category, occurred_on, note, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      legacyRow.id,
      legacyRow.amount_cents,
      legacyRow.category,
      legacyRow.occurred_on,
      legacyRow.note,
      legacyRow.recorded_at,
    );
    db.close();
  }

  function tableNames(db: Database.Database): string[] {
    return db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);
  }

  function indexNames(db: Database.Database): string[] {
    return db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((row) => (row as { name: string }).name);
  }

  // The whole point of adding a migration system: an existing file keeps its
  // data. Without this the six local rows would be orphaned in a table the
  // application no longer reads.
  it('carries legacy expenses over as expense transactions', () => {
    writeLegacyDatabase();

    const db = openDatabase(databasePath);
    const rows = db
      .prepare('SELECT id, kind, amount_cents, category, occurred_on, note, recorded_at FROM transactions')
      .all();

    expect(rows).toEqual([
      { ...legacyRow, kind: 'expense' },
    ]);
    db.close();
  });

  it('drops the legacy table once its rows have moved', () => {
    writeLegacyDatabase();

    const db = openDatabase(databasePath);

    expect(tableNames(db)).not.toContain('expenses');
    expect(tableNames(db)).toContain('transactions');
    db.close();
  });

  // `DROP TABLE` takes the table's indexes with it, which is what keeps the
  // legacy index from lingering as a name pointing at nothing.
  it('takes the legacy index with the legacy table', () => {
    writeLegacyDatabase();

    const db = openDatabase(databasePath);
    const indexes = indexNames(db);

    expect(indexes).not.toContain('idx_expenses_occurred_on');
    expect(indexes).toContain('idx_transactions_occurred_on');
    db.close();
  });

  it('records the schema version so the migration does not run twice', () => {
    writeLegacyDatabase();

    const db = openDatabase(databasePath);
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);
    db.close();
  });

  it('is idempotent across repeated opens', () => {
    writeLegacyDatabase();

    openDatabase(databasePath).close();
    const db = openDatabase(databasePath);

    const count = db.prepare('SELECT COUNT(*) AS n FROM transactions').get() as { n: number };
    expect(count.n).toBe(1);
    db.close();
  });

  it('leaves a fresh database empty but at the current version', () => {
    const db = openDatabase(databasePath);

    expect(tableNames(db)).toContain('transactions');
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);

    const count = db.prepare('SELECT COUNT(*) AS n FROM transactions').get() as { n: number };
    expect(count.n).toBe(0);
    db.close();
  });

  it('refuses to open a database written by a newer build', () => {
    const newer = new Database(databasePath);
    newer.pragma(`user_version = ${SCHEMA_VERSION + 1}`);
    newer.close();

    expect(() => openDatabase(databasePath)).toThrow(/newer|upgrade/i);
  });

  // The invariant the CHECK constraint exists for: a row that no reader can
  // interpret must be refused by storage even if the schema layer is bypassed.
  it('refuses a transaction whose category disagrees with its kind', () => {
    const db = openDatabase(databasePath);

    expect(() =>
      db
        .prepare(
          `INSERT INTO transactions (id, kind, amount_cents, category, occurred_on, note, recorded_at)
           VALUES ('a', 'income', 100, '餐饮', '2026-10-01', NULL, '2026-10-01T00:00:00.000Z')`,
        )
        .run(),
    ).toThrow();

    expect(() =>
      db
        .prepare(
          `INSERT INTO transactions (id, kind, amount_cents, category, occurred_on, note, recorded_at)
           VALUES ('b', 'expense', 100, NULL, '2026-10-01', NULL, '2026-10-01T00:00:00.000Z')`,
        )
        .run(),
    ).toThrow();

    db.close();
  });

  it('refuses a negative amount at the storage layer', () => {
    const db = openDatabase(databasePath);

    expect(() =>
      db
        .prepare(
          `INSERT INTO transactions (id, kind, amount_cents, category, occurred_on, note, recorded_at)
           VALUES ('c', 'expense', -100, '餐饮', '2026-10-01', NULL, '2026-10-01T00:00:00.000Z')`,
        )
        .run(),
    ).toThrow();

    db.close();
  });
});
