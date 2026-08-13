import { ZodError } from 'zod'

export class AppError extends Error {
  statusCode: number
  code: string
  isOperational: boolean

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.isOperational = isOperational
    this.name = this.constructor.name
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'This slot was just taken or resource conflict occurred') {
    super(message, 409, 'SLOT_CONFLICT', true)
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND', true)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Not authenticated') {
    super(message, 401, 'UNAUTHORIZED', true)
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN', true)
  }
}

export class ValidationError extends AppError {
  fields?: Record<string, string[]>

  constructor(message: string = 'Validation failed', fields?: Record<string, string[]>) {
    super(message, 422, 'VALIDATION_ERROR', true)
    this.fields = fields
  }
}

export class PaymentError extends AppError {
  constructor(message: string = 'Payment processing failed') {
    super(message, 402, 'PAYMENT_FAILED', true)
  }
}

export function fromZodError(error: ZodError): ValidationError {
  const fields: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.')
    const key = path || '_root'
    if (!fields[key]) fields[key] = []
    fields[key].push(issue.message)
  }
  return new ValidationError('Validation failed', fields)
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  if (error instanceof ZodError) return fromZodError(error)
  if (error instanceof Error) return new AppError(error.message)
  return new AppError('An unexpected error occurred')
}
