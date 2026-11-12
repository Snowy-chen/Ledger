import Koa from 'koa';
import { bodyParser } from '@koa/bodyparser';

import { errorHandler } from './middleware/error-handler.js';
import { createTransactionRouter } from './routes/transactions.js';
import type { TransactionService } from './services/transaction-service.js';

/**
 * Assemble the Koa app around a service.
 *
 * Taking the service as an argument rather than building it here is what lets
 * the tests hand in a service backed by an in-memory database.
 */
export function createApp(service: TransactionService): Koa {
  const app = new Koa();
  const router = createTransactionRouter(service);

  // Order matters. `errorHandler` is registered first so that it wraps every
  // middleware below it — see its doc comment.
  app.use(errorHandler);
  app.use(bodyParser());
  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}
