import { AppError } from './errors.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(id: string): boolean {
  return UUID_RE.test(id);
}

export function requireUuid(id: string, label = 'id'): string {
  if (!isUuid(id)) {
    throw new AppError('VALIDATION_ERROR', `Invalid ${label}`, 400);
  }
  return id;
}
