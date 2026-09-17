export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_ADDRESS'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 400,
    public readonly field?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}
