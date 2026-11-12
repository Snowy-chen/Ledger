-- Transactions are immutable once recorded: there is no UPDATE path (see CLAUDE.md).
--
-- Note the CHECK constraints below. They are the third enforcement layer of the
-- "money is integer cents" and "kind carries direction" rules, after the prose
-- in CLAUDE.md and the zod schema in @expense/shared. The database refuses bad
-- money even if a future caller bypasses both.
--
-- This file is the BASELINE schema, applied to every database on open. Files
-- that predate it are brought forward by src/db/migrations.ts.

CREATE TABLE IF NOT EXISTS transactions (
  id            TEXT    PRIMARY KEY,
  kind          TEXT    NOT NULL CHECK (kind IN ('expense', 'income')),
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  category      TEXT    CHECK (category IN ('餐饮', '交通', '购物', '娱乐', '居住', '通讯', '医疗', '其他')),
  occurred_on   TEXT    NOT NULL CHECK (occurred_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  note          TEXT,
  recorded_at   TEXT    NOT NULL,

  -- Mirrors the discriminated union in schemas.ts: an expense always has a
  -- category, an income never does. Without this, a row could be written that
  -- no reader can interpret.
  CHECK (
    (kind = 'expense' AND category IS NOT NULL) OR
    (kind = 'income'  AND category IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_transactions_occurred_on ON transactions (occurred_on);
