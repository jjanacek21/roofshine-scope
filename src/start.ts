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

/**
 * The abort can also surface AFTER the middleware chain resolves (while the SSR
 * stream is still writing), where nothing is left to catch it — Node then
 * reports it as an unhandled error and the dev overlay paints a blank screen.
 * Swallow only that specific case at the process level.
 */
declare const process:
  | { on?: (event: string, cb: (err: unknown) => void) => void; __gcnAbortGuard?: boolean }
  | undefined;

if (typeof process !== 'undefined' && process?.on && !process.__gcnAbortGuard) {
  process.__gcnAbortGuard = true;
  const swallow = (error: unknown) => {
    if (!isClientAbort(error)) {
      console.error('[unhandled]', error);
    }
  };
  process.on('unhandledRejection', swallow);
  process.on('uncaughtException', swallow);
}

export const startInstance = createStart(() => ({
  requestMiddleware: [abortTolerantMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));

