export default class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor (statusCode: number, message: string, isOperational: boolean = true) {
       super(message);

       this.statusCode = statusCode;
       this.isOperational = isOperational;

       Error.captureStackTrace(this, this.constructor);
    }
};

// Helper classes for ease-of-development within the application, factory methods for common errors.
export class BadRequestError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
};

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, message);
  }
};

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(403, message);
  }
};

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message);
  }
};

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
};

export class ValidationError extends AppError {
  constructor(message: string) {
    super(422, message);
  }
};

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(500, message, false);
  }
};
