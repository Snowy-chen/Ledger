import Router from '@koa/router';
import {
  PeriodSchema,
  TransactionInputSchema,
  periodOf,
  toIsoDate,
  type Period,
} from '@expense/shared';
import type { Context } from 'koa';
import { z } from 'zod';

import { parseBody } from '../middleware/validate.js';
import type { TransactionService } from '../services/transaction-service.js';

/** How many months the trend chart shows when the client does not say. */
const DEFAULT_TREND_MONTHS = 6;

/** A full year of bars is already unreadable on a 390px screen. */
const MAX_TREND_MONTHS = 12;

const IdSchema = z.uuid();

/** `ctx.query` hands back `string | string[] | undefined`, never a number. */
const MonthsSchema = z.coerce.number().int().min(1).max(MAX_TREND_MONTHS);

/** The period to fall back to when the client does not name one: this month. */
function defaultPeriod(): Period {
  return periodOf(toIsoDate(new Date()));
}

/**
 * A missing `period` means "this month". A *malformed* one is a client mistake
 * and must fail loudly — silently falling back would hide the bug.
 */
function periodFrom(ctx: Context): Period {
  const raw = ctx.query['period'];
  if (raw === undefined) {
    return defaultPeriod();
  }
  return PeriodSchema.parse(raw);
}

export function createTransactionRouter(service: TransactionService): Router {
  const router = new Router({ prefix: '/api' });

  router.get('/transactions', (ctx) => {
    ctx.body = { transactions: service.list(periodFrom(ctx)) };
  });

  router.post('/transactions', (ctx) => {
    const input = parseBody(ctx, TransactionInputSchema);
    ctx.status = 201;
    ctx.body = service.record(input);
  });

  router.delete('/transactions/:id', (ctx) => {
    // Parsed, so a non-uuid id is a 400 rather than a pointless 404.
    const id = IdSchema.parse(ctx.params['id']);

    if (!service.remove(id)) {
      ctx.status = 404;
      ctx.body = { error: 'TransactionNotFound' };
      return;
    }

    ctx.status = 204;
  });

  router.get('/summary', (ctx) => {
    ctx.body = service.summarize(periodFrom(ctx));
  });

  router.get('/balance', (ctx) => {
    ctx.body = service.balance();
  });

  router.get('/trend', (ctx) => {
    const raw = ctx.query['months'];
    const months = raw === undefined ? DEFAULT_TREND_MONTHS : MonthsSchema.parse(raw);
    ctx.body = service.trend(periodFrom(ctx), months);
  });

  return router;
}
