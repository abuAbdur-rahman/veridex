export class AppError extends Error {
	constructor(
		public code: string,
		message: string,
		public statusCode: number,
		public details?: unknown,
	) {
		super(message);
	}
}

export class UnauthorizedError extends AppError {
	constructor() {
		super("UNAUTHORIZED", "Session required", 401);
	}
}

export class ForbiddenError extends AppError {
	constructor(message = "Insufficient permissions") {
		super("FORBIDDEN", message, 403);
	}
}

export class NotFoundError extends AppError {
	constructor(resource: string) {
		super("NOT_FOUND", `${resource} not found`, 404);
	}
}

export class ValidationError extends AppError {
	constructor(details: unknown) {
		super("VALIDATION_ERROR", "Invalid input", 422, details);
	}
}