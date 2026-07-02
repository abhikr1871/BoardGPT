import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler so a rejected promise is forwarded to Express's
 * error middleware instead of becoming an unhandled rejection (Express 4 does
 * not await handlers). Keeps every route's error path consistent → clean 500s.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
