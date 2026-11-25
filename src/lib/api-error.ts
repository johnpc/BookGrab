import { NextResponse } from "next/server";
import type { ApiError, ApiErrorCode } from "@/types";

/** Error that already knows which HTTP status and machine code it maps to. */
export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly hint?: string;

  constructor(
    code: ApiErrorCode,
    message: string,
    options: { status?: number; hint?: string; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.status = options.status ?? defaultStatus(code);
    this.hint = options.hint;
  }
}

function defaultStatus(code: ApiErrorCode): number {
  switch (code) {
    case "BAD_REQUEST":
      return 400;
    case "MAM_NOT_CONFIGURED":
      return 503;
    case "MAM_AUTH":
      return 502;
    case "MAM_UPSTREAM":
    case "TRANSMISSION_UPSTREAM":
      return 502;
    case "INTERNAL":
      return 500;
  }
}

export function toAppError(error: unknown, fallback: ApiErrorCode = "INTERNAL"): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : "Unexpected error";
  return new AppError(fallback, message, { cause: error });
}

export function errorResponse(error: unknown, fallback: ApiErrorCode = "INTERNAL") {
  const appError = toAppError(error, fallback);
  const body: ApiError = {
    error: appError.message,
    code: appError.code,
    ...(appError.hint ? { hint: appError.hint } : {}),
  };
  return NextResponse.json(body, { status: appError.status });
}
