import { NextResponse } from 'next/server'
import { AppError } from './errors'

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
  if (error instanceof AppError) {
    return {
      success: false,
      error: { code: error.code, message: error.message }
    }
  }

  return {
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
  }
}

export function okResponse<T>(data: T, status = 200): NextResponse<SuccessResponse<T>> {
  return NextResponse.json(ok(data), { status })
}

export function failResponse(error: unknown): NextResponse<ErrorResponse> {
  const status = error instanceof AppError ? error.statusCode : 500
  return NextResponse.json(fail(error), { status })
}
