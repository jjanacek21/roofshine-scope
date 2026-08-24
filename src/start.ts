import { createStart, createMiddleware } from '@tanstack/react-start';
import { attachSupabaseAuth } from '@/integrations/supabase/auth-attacher';

/**
 * A client that navigates away (or reloads) mid-render kills the socket and
 * Node throws `Error: aborted` / ECONNRESET. That is not an app failure — it
 * must not bubble up as an unhandled 500 error overlay.
 */
function isClientAbort(error: unknown): boolean {
  const err = error as { code?: string; message?: string; cause?: unknown } | null;
  if (!err) return false;
  if (err.code === 'ECONNRESET' || err.code === 'ABORT_ERR') return true;
  if (typeof err.message === 'string' && /aborted|ECONNRESET/i.test(err.message)) return true;
  return err.cause ? isClientAbort(err.cause) : false;
}

const abortTolerantMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ next }) => {
    try {
      return await next();
    } catch (error) {
      if (isClientAbort(error)) {
        return new Response(null, { status: 499 }) as never;
      }
      throw error;
    }
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [abortTolerantMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
