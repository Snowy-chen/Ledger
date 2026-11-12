import type { Db } from './index.js';

/**
 * The schema version `schema.sql` describes.
 *
 * `schema.sql` is declarative and always applied, so it only ever creates the
 * *current* shape. This number is what lets an older file be brought forward:
 * bump it whenever the baseline changes in a way an existing database cannot
 * absorb on its own.
 */
export const SCHEMA_VERSION = 1;

interface Migration {
  /** The version this step produces. Steps run in ascending order. */
  readonly to: number;
  /** Why the step exists, for the failure message. */
  readonly describe: string;
  run(db: Db): void;
}

function tableExists(db: Db, name: string): boolean {
  return db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !== undefined;
}

/**
 * Every step needed to lift a database from any older version to
 * `SCHEMA_VERSION`. Append only — never edit or reorder a shipped step, or two
 * databases at the same version will have different shapes.
 */
const MIGRATIONS: readonly Migration[] = [
  {
    to: 1,
    describe: "carry the legacy `expenses` table over as expense transactions",
    run(db) {
      // A v0 database stores expenses only, in a table called `expenses`, with
      // a CHECK that admits exactly the four categories we started with. Every
      // one of those is still in the enum, so no row can be rejected here.
      if (!tableExists(db, 'expenses')) {
        return; // Fresh database: the baseline already built the right table.
      }

      db.exec(
        `INSERT INTO transactions (id, kind, amount_cents, category, occurred_on, note, recorded_at)
         SELECT id, 'expense', amount_cents, category, occurred_on, note, recorded_at
           FROM expenses`,
      );

      // Dropping the table takes its indexes with it.
      db.exec('DROP TABLE expenses');
    },
  },
];

/**
 * Bring `db` up to `SCHEMA_VERSION`.
 *
 * Must run **after** the baseline schema has been applied: each step assumes
 * the current tables exist and only moves data. Every step runs inside one
 * transaction, so a failure leaves the file exactly as it was rather than
 * half-migrated.
 */
export function migrate(db: Db): void {
  const from = db.pragma('user_version', { simple: true }) as number;

  if (from === SCHEMA_VERSION) {
    return;
  }

  // Refuse to guess. A file written by a newer build may hold columns this
  // build would silently drop on the next write.
  if (from > SCHEMA_VERSION) {
    throw new Error(
      `Database is at v${from}, but this build only understands v${SCHEMA_VERSION}. ` +
        'Refusing to open it — upgrade the application instead.',
    );
  }

  const pending = MIGRATIONS.filter((step) => step.to > from).sort((a, b) => a.to - b.to);

  db.transaction(() => {
    for (const step of pending) {
      try {
        step.run(db);
      } catch (cause) {
        throw new Error(`Migration to v${step.to} failed (${step.describe})`, { cause });
      }
    }
    // `PRAGMA user_version` does not accept a bound parameter, hence the
    // interpolation — `SCHEMA_VERSION` is an integer literal in this file.
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  })();
}
