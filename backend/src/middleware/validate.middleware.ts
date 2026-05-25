import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { AppError } from '../utils/errors.js';

type Schema = z.ZodTypeAny;

export function validateBody(schema: Schema): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      next(
        new AppError(
          'VALIDATION_ERROR',
          parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
          400
        )
      );
      return;
    }
    req.body = parsed.data;
    next();
  };
}

export function validateQuery(schema: Schema): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      next(
        new AppError(
          'VALIDATION_ERROR',
          parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
          400
        )
      );
      return;
    }
    req.query = parsed.data as typeof req.query;
    next();
  };
}
