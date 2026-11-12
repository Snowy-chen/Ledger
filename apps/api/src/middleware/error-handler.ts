import type { Context, Next } from 'koa';
import { ZodError } from 'zod';

interface ErrorBody {
  error: string;
  details?: unknown;
}

/**
 * The outermost middleware of the Koa onion.
 *
 * It must be registered first, before any other middleware: everything below it
 * is inside the `try`, and anything registered above it would throw outside it.
 *
 * A rejected zod schema is a client mistake, so it becomes a 400. Anything else
 * is ours, and becomes a 500.
 */
export async function errorHandler(ctx: Context, next: Next): Promise<void> {
  try {
    await next();
  } catch (error) {
    if (error instanceof ZodError) {
      ctx.status = 400;
      ctx.body = {
        error: 'ValidationError',
        details: error.issues,
      } satisfies ErrorBody;
      return;
    }

    ctx.status = 500;
    ctx.body = { error: 'InternalServerError' } satisfies ErrorBody;
    ctx.app.emit('error', error, ctx);
  }
}
