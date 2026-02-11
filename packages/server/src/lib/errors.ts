/**
 * Centralized Error Handling
 *
 * Provides standardized error types and handling for consistent API responses.
 * All errors should use these classes and utilities for proper error handling.
 */

import { randomUUID } from 'node:crypto';

/**
 * Error codes for API responses
 */
export enum ErrorCode {
  // Authentication errors (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',

  // Authorization errors (403)
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  FORBIDDEN = 'FORBIDDEN',

  // Not found errors (404)
  NOT_FOUND = 'NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  JOURNAL_NOT_FOUND = 'JOURNAL_NOT_FOUND',
  NOTE_NOT_FOUND = 'NOTE_NOT_FOUND',
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',

  // Validation errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Conflict errors (409)
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',

  // Server errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  FILE_SYSTEM_ERROR = 'FILE_SYSTEM_ERROR',

  // Service unavailable (503)
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Streaming/Upload specific
  INVALID_STREAM = 'INVALID_STREAM',
  STREAM_EXPIRED = 'STREAM_EXPIRED',
}

/**
 * HTTP status code mapping for error codes
 */
const errorCodeToStatus: Record<ErrorCode, number> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.SESSION_EXPIRED]: 401,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.PERMISSION_DENIED]: 403,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.USER_NOT_FOUND]: 404,
  [ErrorCode.JOURNAL_NOT_FOUND]: 404,
  [ErrorCode.NOTE_NOT_FOUND]: 404,
  [ErrorCode.TEMPLATE_NOT_FOUND]: 404,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.INVALID_FORMAT]: 400,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.FILE_SYSTEM_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.INVALID_STREAM]: 400,
  [ErrorCode.STREAM_EXPIRED]: 410,
};

/**
 * Base API Error class
 */
export class APIError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly requestId?: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      details?: Record<string, unknown>;
      requestId?: string;
      cause?: Error;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'APIError';
    this.code = code;
    this.status = errorCodeToStatus[code];
    this.requestId = options?.requestId;
    this.details = options?.details;
  }

  /**
   * Convert error to JSON response format
   */
  toJSON(): APIErrorResponse {
    return {
      error: this.message,
      code: this.code,
      requestId: this.requestId,
      details: this.details,
    };
  }

  /**
   * Create a Response object from this error
   */
  toResponse(): Response {
    return new Response(JSON.stringify(this.toJSON()), {
      status: this.status,
      headers: {
        'Content-Type': 'application/json',
        ...(this.requestId ? { 'X-Request-Id': this.requestId } : {}),
      },
    });
  }
}

/**
 * API Error Response format
 */
export interface APIErrorResponse {
  error: string;
  code: ErrorCode;
  requestId?: string;
  details?: Record<string, unknown>;
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  options?: {
    details?: Record<string, unknown>;
    requestId?: string;
  }
): Response {
  const status = errorCodeToStatus[code];
  const body: APIErrorResponse = {
    error: message,
    code,
    requestId: options?.requestId,
    details: options?.details,
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.requestId ? { 'X-Request-Id': options.requestId } : {}),
    },
  });
}

/**
 * Factory functions for common errors
 */
export const Errors = {
  unauthorized: (message = 'Unauthorized', requestId?: string) =>
    new APIError(ErrorCode.UNAUTHORIZED, message, { requestId }),

  permissionDenied: (message = 'Permission denied', requestId?: string) =>
    new APIError(ErrorCode.PERMISSION_DENIED, message, { requestId }),

  notFound: (resource: string, requestId?: string) =>
    new APIError(ErrorCode.NOT_FOUND, `${resource} not found`, { requestId }),

  validationError: (message: string, details?: Record<string, unknown>, requestId?: string) =>
    new APIError(ErrorCode.VALIDATION_ERROR, message, { details, requestId }),

  invalidInput: (field: string, reason: string, requestId?: string) =>
    new APIError(ErrorCode.INVALID_INPUT, `Invalid ${field}: ${reason}`, { requestId }),

  missingField: (field: string, requestId?: string) =>
    new APIError(ErrorCode.MISSING_REQUIRED_FIELD, `Missing required field: ${field}`, { requestId }),

  alreadyExists: (resource: string, requestId?: string) =>
    new APIError(ErrorCode.ALREADY_EXISTS, `${resource} already exists`, { requestId }),

  internalError: (message = 'Internal server error', cause?: Error, requestId?: string) =>
    new APIError(ErrorCode.INTERNAL_ERROR, message, { requestId, cause }),

  databaseError: (message = 'Database error', cause?: Error, requestId?: string) =>
    new APIError(ErrorCode.DATABASE_ERROR, message, { requestId, cause }),

  serviceUnavailable: (service: string, requestId?: string) =>
    new APIError(ErrorCode.SERVICE_UNAVAILABLE, `${service} is currently unavailable`, { requestId }),
};

/**
 * Handle unknown errors and convert to APIError
 */
export function handleError(
  error: unknown,
  requestId?: string
): { response: Response; logged: boolean } {
  let apiError: APIError;
  let logged = false;

  if (error instanceof APIError) {
    apiError = error;
  } else if (error instanceof Error) {
    // Log unexpected errors
    console.error('[Error]', {
      requestId,
      message: error.message,
      stack: error.stack,
    });
    logged = true;
    apiError = Errors.internalError('An unexpected error occurred', error, requestId);
  } else {
    // Unknown error type
    console.error('[Error] Unknown error:', { requestId, error });
    logged = true;
    apiError = Errors.internalError('An unexpected error occurred', undefined, requestId);
  }

  return {
    response: apiError.toResponse(),
    logged,
  };
}

/**
 * Async handler wrapper that catches errors and returns proper responses
 */
export function asyncHandler<T extends Request>(
  handler: (request: T) => Promise<Response>
): (request: T) => Promise<Response> {
  return async (request: T) => {
    const requestId = generateRequestId();

    try {
      return await handler(request);
    } catch (error) {
      const { response } = handleError(error, requestId);
      return response;
    }
  };
}

/**
 * Type guard for checking if an error is an APIError
 */
export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError;
}

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}
