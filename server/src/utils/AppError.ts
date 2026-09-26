import type { ApiErrorCode } from '../../../shared/types';

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION: 400,
  INVALID_IMAGE: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  LOW_CONFIDENCE: 422,
  NOT_IDENTIFIED: 422,
  PERSON_DETECTED: 422,
  RATE_LIMITED: 429,
  AI_FAILURE: 502,
  INTERNAL: 500,
  UNAVAILABLE: 503,
};

/** Expected, user-facing errors. Anything else is treated as a 500. */
export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.status = STATUS[code];
  }
}
