import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { openDatabase } from '../db/index.js';
import { createTransactionRepository } from '../repositories/transaction-repository.js';
import { createTransactionService } from '../services/transaction-service.js';

type Agent = ReturnType<typeof request>;

/**
 * A fresh agent over a fresh in-memory database, so no test can see another's
 * data. `app.callback()` is how a Koa application is handed to supertest.
 */
function makeAgent(): Agent {
  const db = openDatabase(':memory:');
  const app = createApp(createTransactionService(createTransactionRepository(db)));
  return request(app.callback());
}

const lunch = {
  kind: 'expense',
  amountCents: 1250,
  category: '餐饮',
  occurredOn: '2026-10-03',
  note: '午饭',
};

const salary = {
  kind: 'income',
  amountCents: 850_000,
  occurredOn: '2026-10-01',
  note: '工资',
};

/** A category that is *not* in the enum, used as the "outside" probe. */
const NOT_A_CATEGORY = '数码';

describe('POST /api/transactions', () => {
  it('records an expense and echoes it back', async () => {
    const response = await makeAgent().post('/api/transactions').send(lunch).expect(201);

    expect(response.body).toMatchObject({
      kind: 'expense',
      amountCents: 1250,
      category: '餐饮',
      occurredOn: '2026-10-03',
      note: '午饭',
    });
    expect(response.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof response.body.recordedAt).toBe('string');
  });

  it('records an income with a null category', async () => {
    const response = await makeAgent().post('/api/transactions').send(salary).expect(201);

    expect(response.body).toMatchObject({ kind: 'income', amountCents: 850_000, category: null });
  });

  it('stores the amount as an integer number of cents', async () => {
    const response = await makeAgent().post('/api/transactions').send(lunch).expect(201);
    expect(Number.isInteger(response.body.amountCents)).toBe(true);
  });

  // 12.5 cents does not exist. If a float ever reaches storage, the whole
  // money model has failed — so the boundary must reject it outright.
  it('rejects a float amount', async () => {
    const response = await makeAgent()
      .post('/api/transactions')
      .send({ ...lunch, amountCents: 12.5 })
      .expect(400);

    expect(response.body.error).toBe('ValidationError');
  });

  // Direction lives in `kind`; the amount is positive on both sides. A
  // negative income is not a refund, it is a bug.
  it('rejects a zero or negative amount, for either kind', async () => {
    await makeAgent().post('/api/transactions').send({ ...lunch, amountCents: 0 }).expect(400);
    await makeAgent().post('/api/transactions').send({ ...lunch, amountCents: -100 }).expect(400);
    await makeAgent().post('/api/transactions').send({ ...salary, amountCents: -100 }).expect(400);
  });

  it('rejects a category outside the closed enum', async () => {
    await makeAgent()
      .post('/api/transactions')
      .send({ ...lunch, category: NOT_A_CATEGORY })
      .expect(400);
  });

  it('accepts a category that is inside the expanded enum', async () => {
    await makeAgent().post('/api/transactions').send({ ...lunch, category: '娱乐' }).expect(201);
  });

  // The kind <-> category invariant, enforced at the boundary.
  it('rejects an income that carries a category', async () => {
    await makeAgent()
      .post('/api/transactions')
      .send({ ...salary, category: '餐饮' })
      .expect(400);
  });

  it('rejects an expense with no category', async () => {
    await makeAgent().post('/api/transactions').send({ ...lunch, category: null }).expect(400);
  });

  it('rejects an unknown kind', async () => {
    await makeAgent().post('/api/transactions').send({ ...lunch, kind: 'transfer' }).expect(400);
  });

  it('rejects an unknown field instead of dropping it', async () => {
    await makeAgent().post('/api/transactions').send({ ...lunch, amount: 12.5 }).expect(400);
  });

  it('rejects a timestamp where a calendar date belongs', async () => {
    await makeAgent()
      .post('/api/transactions')
      .send({ ...lunch, occurredOn: '2026-10-03T09:00:00.000Z' })
      .expect(400);
  });
});

describe('GET /api/transactions', () => {
  let agent: Agent;

  beforeEach(async () => {
    agent = makeAgent();
    await agent.post('/api/transactions').send(lunch).expect(201);
    await agent
      .post('/api/transactions')
      .send({ ...lunch, amountCents: 300, category: '交通', occurredOn: '2026-10-04' })
      .expect(201);
    // A different month: must never appear in the 2026-10 listing.
    await agent
      .post('/api/transactions')
      .send({ ...lunch, amountCents: 999, occurredOn: '2026-09-30' })
      .expect(201);
  });

  // This is the assertion behind the money rule: whatever goes in or out of
  // the wire, `amountCents` is always a whole number.
  it('returns every amount as an integer, never a float', async () => {
    const response = await agent.get('/api/transactions?period=2026-10').expect(200);

    expect(response.body.transactions).toHaveLength(2);
    for (const transaction of response.body.transactions) {
      expect(Number.isInteger(transaction.amountCents)).toBe(true);
      expect(transaction.amountCents % 1).toBe(0);
    }
  });

  it('returns dates as YYYY-MM-DD strings, never timestamps', async () => {
    const response = await agent.get('/api/transactions?period=2026-10').expect(200);

    for (const transaction of response.body.transactions) {
      expect(transaction.occurredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('mixes expenses and income into one list, newest occurrence first', async () => {
    await agent.post('/api/transactions').send(salary).expect(201);

    const response = await agent.get('/api/transactions?period=2026-10').expect(200);

    // The income is dated 2026-10-01 and the expenses 2026-10-03/04, so the
    // expenses must come first. Asserted across days only: same-day ties are
    // broken by `recorded_at` at millisecond resolution, which would flake.
    expect(response.body.transactions.map((t: { kind: string }) => t.kind)).toEqual([
      'expense',
      'expense',
      'income',
    ]);
  });

  it('scopes the listing to the requested period', async () => {
    const response = await agent.get('/api/transactions?period=2026-09').expect(200);

    expect(response.body.transactions).toHaveLength(1);
    expect(response.body.transactions[0].amountCents).toBe(999);
  });

  it('defaults to the current month when no period is given', async () => {
    const response = await agent.get('/api/transactions').expect(200);
    expect(Array.isArray(response.body.transactions)).toBe(true);
  });

  it('rejects a malformed period', async () => {
    await agent.get('/api/transactions?period=2026-13').expect(400);
  });
});

describe('DELETE /api/transactions/:id', () => {
  it('deletes a recorded transaction', async () => {
    const agent = makeAgent();
    const created = await agent.post('/api/transactions').send(lunch).expect(201);

    await agent.delete(`/api/transactions/${created.body.id}`).expect(204);

    const listing = await agent.get('/api/transactions?period=2026-10').expect(200);
    expect(listing.body.transactions).toHaveLength(0);
  });

  it('404s for an unknown id', async () => {
    await makeAgent()
      .delete('/api/transactions/3f2504e0-4f89-41d3-9a0c-0305e82c3301')
      .expect(404);
  });

  it('400s for an id that is not a uuid at all', async () => {
    await makeAgent().delete('/api/transactions/not-a-uuid').expect(400);
  });
});

describe('GET /api/summary', () => {
  it('splits the period by kind and nets them out', async () => {
    const agent = makeAgent();
    await agent.post('/api/transactions').send(lunch).expect(201);
    await agent
      .post('/api/transactions')
      .send({ ...lunch, amountCents: 300, category: '交通', occurredOn: '2026-10-04' })
      .expect(201);
    await agent.post('/api/transactions').send(salary).expect(201);

    const response = await agent.get('/api/summary?period=2026-10').expect(200);

    expect(response.body.period).toBe('2026-10');
    expect(response.body.expenseCents).toBe(1550);
    expect(response.body.incomeCents).toBe(850_000);
    expect(response.body.netCents).toBe(848_450);
    expect(Number.isInteger(response.body.netCents)).toBe(true);
  });

  it('groups expenses by category, and never by income', async () => {
    const agent = makeAgent();
    await agent.post('/api/transactions').send(lunch).expect(201);
    await agent
      .post('/api/transactions')
      .send({ ...lunch, amountCents: 700, category: '娱乐', occurredOn: '2026-10-05' })
      .expect(201);
    await agent.post('/api/transactions').send(salary).expect(201);

    const response = await agent.get('/api/summary?period=2026-10').expect(200);

    // The total and the breakdown come from two different queries, so this
    // pins them to each other: they must never disagree.
    expect(response.body.expenseCents).toBe(1950);
    expect(response.body.byCategory).toEqual([
      { category: '餐饮', totalCents: 1250 },
      { category: '娱乐', totalCents: 700 },
    ]);
  });

  // A month that costs more than it earns nets negative. Nothing else in the
  // system is allowed to be, which is why this needs its own assertion.
  it('reports a negative net when the period spent more than it earned', async () => {
    const agent = makeAgent();
    await agent.post('/api/transactions').send(lunch).expect(201);

    const response = await agent.get('/api/summary?period=2026-10').expect(200);
    expect(response.body.netCents).toBe(-1250);
  });

  it('excludes transactions from another period', async () => {
    const agent = makeAgent();
    await agent.post('/api/transactions').send(lunch).expect(201);
    await agent
      .post('/api/transactions')
      .send({ ...lunch, amountCents: 999, occurredOn: '2026-11-01' })
      .expect(201);

    const response = await agent.get('/api/summary?period=2026-10').expect(200);
    expect(response.body.expenseCents).toBe(1250);
  });

  it('reports zero for a period with no transactions', async () => {
    const response = await makeAgent().get('/api/summary?period=2026-10').expect(200);

    expect(response.body).toEqual({
      period: '2026-10',
      expenseCents: 0,
      incomeCents: 0,
      netCents: 0,
      byCategory: [],
    });
  });
});

describe('GET /api/balance', () => {
  it('is zero for an empty database', async () => {
    const response = await makeAgent().get('/api/balance').expect(200);

    expect(response.body).toEqual({ incomeCents: 0, expenseCents: 0, netCents: 0 });
  });

  // The defining property of the balance: it is NOT a period. A transaction
  // from any month counts, which is what separates it from /api/summary.
  it('accumulates across periods, not just the current one', async () => {
    const agent = makeAgent();
    await agent.post('/api/transactions').send(salary).expect(201);
    await agent
      .post('/api/transactions')
      .send({ ...lunch, occurredOn: '2026-08-15' })
      .expect(201);
    await agent
      .post('/api/transactions')
      .send({ ...lunch, amountCents: 750, occurredOn: '2025-01-09' })
      .expect(201);

    const response = await agent.get('/api/balance').expect(200);

    expect(response.body.incomeCents).toBe(850_000);
    expect(response.body.expenseCents).toBe(2000);
    expect(response.body.netCents).toBe(848_000);
  });

  it('goes negative when more was spent than earned', async () => {
    const agent = makeAgent();
    await agent.post('/api/transactions').send(lunch).expect(201);

    const response = await agent.get('/api/balance').expect(200);
    expect(response.body.netCents).toBe(-1250);
  });

  it('is unchanged by deleting from another period', async () => {
    const agent = makeAgent();
    const old = await agent
      .post('/api/transactions')
      .send({ ...lunch, amountCents: 500, occurredOn: '2026-01-02' })
      .expect(201);
    await agent.post('/api/transactions').send(lunch).expect(201);

    await agent.delete(`/api/transactions/${old.body.id}`).expect(204);

    const response = await agent.get('/api/balance').expect(200);
    expect(response.body.expenseCents).toBe(1250);
  });

  // The endpoint deliberately takes no `period`, so sending one must change
  // nothing. This is the assertion behind "the balance is not a period".
  it('ignores a period query parameter', async () => {
    const agent = makeAgent();
    await agent.post('/api/transactions').send({ ...lunch, occurredOn: '2026-08-15' }).expect(201);
    await agent.post('/api/transactions').send(lunch).expect(201);

    const withoutPeriod = await agent.get('/api/balance').expect(200);
    const withPeriod = await agent.get('/api/balance?period=2026-08').expect(200);

    expect(withPeriod.body).toEqual(withoutPeriod.body);
    expect(withPeriod.body.expenseCents).toBe(2500);
  });
});

describe('GET /api/trend', () => {
  it('returns consecutive months ending at the requested period, oldest first', async () => {
    const response = await makeAgent().get('/api/trend?period=2026-10&months=3').expect(200);

    expect(response.body.periods.map((p: { period: string }) => p.period)).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
  });

  // A quiet month must appear as a zero bar, not vanish — otherwise the
  // x-axis would silently compress and the chart would mislead.
  it('fills months with no transactions as zeros', async () => {
    const agent = makeAgent();
    await agent.post('/api/transactions').send(lunch).expect(201);

    const response = await agent.get('/api/trend?period=2026-10&months=3').expect(200);

    expect(response.body.periods).toEqual([
      { period: '2026-08', expenseCents: 0, incomeCents: 0 },
      { period: '2026-09', expenseCents: 0, incomeCents: 0 },
      { period: '2026-10', expenseCents: 1250, incomeCents: 0 },
    ]);
  });

  it('splits each month by kind', async () => {
    const agent = makeAgent();
    await agent.post('/api/transactions').send(lunch).expect(201);
    await agent.post('/api/transactions').send(salary).expect(201);

    const response = await agent.get('/api/trend?period=2026-10&months=1').expect(200);

    expect(response.body.periods).toEqual([
      { period: '2026-10', expenseCents: 1250, incomeCents: 850_000 },
    ]);
  });

  it('defaults to six months', async () => {
    const response = await makeAgent().get('/api/trend?period=2026-10').expect(200);
    expect(response.body.periods).toHaveLength(6);
  });

  it('rejects a month count out of range', async () => {
    await makeAgent().get('/api/trend?period=2026-10&months=0').expect(400);
    await makeAgent().get('/api/trend?period=2026-10&months=99').expect(400);
    await makeAgent().get('/api/trend?period=2026-10&months=abc').expect(400);
  });

  it('rejects a malformed period', async () => {
    await makeAgent().get('/api/trend?period=2026-13').expect(400);
  });
});
