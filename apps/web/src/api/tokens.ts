import { apiRequest, isRecord } from "@/api/client";

export interface ServerApiToken {
	id: string;
	name: string;
	tokenPrefix: string;
	lastUsedAt: string | null;
	expiresAt: string | null;
	revokedAt: string | null;
	createdAt: string;
}

export interface CreatedApiToken extends ServerApiToken {
	token: string;
}

function nullableString(value: unknown): value is string | null {
	return value === null || typeof value === "string";
}

export function isServerApiToken(value: unknown): value is ServerApiToken {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.name === "string" &&
		typeof value.tokenPrefix === "string" &&
		nullableString(value.lastUsedAt) &&
		nullableString(value.expiresAt) &&
		nullableString(value.revokedAt) &&
		typeof value.createdAt === "string"
	);
}

function isCreatedApiToken(value: unknown): value is CreatedApiToken {
	return isRecord(value) && isServerApiToken(value) && typeof value.token === "string";
}

export function listApiTokens() {
	return apiRequest(
		"/api/tokens",
		(value): value is ServerApiToken[] => Array.isArray(value) && value.every(isServerApiToken),
	);
}

export function createApiToken(name: string) {
	return apiRequest<CreatedApiToken>("/api/tokens", isCreatedApiToken, {
		method: "POST",
		body: JSON.stringify({ name }),
	});
}

export function revokeApiToken(tokenId: string) {
	return apiRequest(
		`/api/tokens/${encodeURIComponent(tokenId)}`,
		(value): value is null => value === null,
		{ method: "DELETE" },
	);
}
