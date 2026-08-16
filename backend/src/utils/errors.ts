/**
 * Application error type.
 *
 * Anything thrown as an AppError is considered safe to show the user. Every
 * other throw is treated as an internal fault: it is logged with its stack and
 * reported to the client as a generic message with a request id, so stack
 * traces and internal detail never leave the server.
 */

export type ErrorCode =
  | 'validation_failed'
  | 'unauthorized'
  | 'invalid_credentials'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'email_taken'
  | 'payload_too_large'
  | 'unsupported_type'
  | 'empty_file'
  | 'extraction_failed'
  | 'too_little_text'
  | 'analysis_failed'
  | 'scan_not_ready'
  | 'rate_limited'
  | 'internal_error';

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  /** Actionable guidance shown under the message in the UI. */
  readonly hint: string | undefined;
  readonly details: unknown;

  constructor(status: number, code: ErrorCode, message: string, hint?: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.hint = hint;
    this.details = details;
  }

  static badRequest(code: ErrorCode, message: string, hint?: string, details?: unknown): AppError {
    return new AppError(400, code, message, hint, details);
  }

  static unauthorized(message = 'Authentication required.', hint?: string): AppError {
    return new AppError(401, 'unauthorized', message, hint);
  }

  static forbidden(message = 'You do not have access to this resource.'): AppError {
    return new AppError(403, 'forbidden', message);
  }

  static notFound(message = 'Not found.'): AppError {
    return new AppError(404, 'not_found', message);
  }

  static conflict(code: ErrorCode, message: string, hint?: string): AppError {
    return new AppError(409, code, message, hint);
  }
}

/** Extraction failures carry a user-facing hint about how to fix the file. */
export class ExtractionError extends AppError {
  constructor(code: ErrorCode, message: string, hint: string) {
    super(400, code, message, hint);
    this.name = 'ExtractionError';
  }
}
