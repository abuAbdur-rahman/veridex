export class ApiError extends Error {
	code: string;
	status: number;
	details?: unknown;

	constructor(code: string, message: string, status: number, details?: unknown) {
		super(message);
		this.code = code;
		this.status = status;
		this.details = details;
	}
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export async function apiRequest<T>(
	path: string,
	validate: (value: unknown) => value is T,
	init?: RequestInit,
) {
	const hasJsonBody = init?.body !== undefined && !(init.body instanceof FormData);
	const response = await fetch(path, {
		credentials: "include",
		...init,
		headers: {
			...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
			...(init?.headers ?? {}),
		},
	});
	const body = (await response.json().catch(() => null)) as unknown;
	if (!response.ok) {
		const error = isRecord(body) && isRecord(body.error) ? body.error : undefined;
		throw new ApiError(
			typeof error?.code === "string" ? error.code : "HTTP_ERROR",
			typeof error?.message === "string" ? error.message : response.statusText,
			response.status,
			error?.details,
		);
	}
	if (!validate(body)) {
		throw new ApiError(
			"INVALID_RESPONSE",
			"The server returned an invalid response",
			response.status,
		);
	}
	return body;
}

export function readErrorText(value: unknown): string | undefined {
	if (typeof value === "string" && value.trim()) return value;
	if (!isRecord(value)) return undefined;
	return readErrorText(value.message) ?? readErrorText(value.error);
}
