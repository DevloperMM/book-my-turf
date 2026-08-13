import { NextResponse } from 'next/server'
import { ValidationError, toAppError } from './errors'

type SuccessResponse<T> = {
  success: true
  data: T
}

type ErrorResponse = {
  success: false
  error: {
    code: string
    message: string
  }
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse

export function ok<T>(data: T): SuccessResponse<T> {
  return { success: true, data }
}

export function fail(error: unknown): ErrorResponse {
  const appError = toAppError(error)

  return {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError instanceof ValidationError && appError.fields ? { fields: appError.fields } : {})
    }
  }
}

export function okResponse<T>(data: T, status = 200): NextResponse<SuccessResponse<T>> {
  return NextResponse.json(ok(data), { status })
}

export function failResponse(error: unknown): NextResponse<ErrorResponse> {
  const appError = toAppError(error)
  return NextResponse.json(fail(error), { status: appError.statusCode })
}
