import type { Context } from 'koa';
import type { ZodType } from 'zod';

/**
 * Parse a value crossing the HTTP boundary.
 *
 * Every request body goes through here, so "parsed through a zod schema" is one
 * function rather than a habit. A rejected value throws `ZodError`, which
 * `errorHandler` turns into a 400.
 */
export function parseBody<T>(ctx: Context, schema: ZodType<T>): T {
  return schema.parse(ctx.request.body);
}
