import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { apiTokens } from "../db/schema/index.js";
import { NotFoundError, UnauthorizedError } from "../lib/errors.js";

export function hashToken(token: string) {
	return createHash("sha256").update(token).digest("hex");
}

export async function authenticateApiToken(
	db: Database,
	authorizationHeader: string | undefined,
) {
	if (!authorizationHeader?.startsWith("Bearer ")) throw new UnauthorizedError();
	const token = authorizationHeader.slice("Bearer ".length).trim();
	if (!/^vrx_[A-Za-z0-9_-]{32}$/.test(token)) throw new UnauthorizedError();

	const [apiToken] = await db
		.select({
			id: apiTokens.id,
			userId: apiTokens.userId,
			expiresAt: apiTokens.expiresAt,
		})
		.from(apiTokens)
		.where(
			and(
				eq(apiTokens.tokenHash, hashToken(token)),
				isNull(apiTokens.revokedAt),
				or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, new Date())),
			),
		)
		.limit(1);

	if (!apiToken) throw new UnauthorizedError();
	await db
		.update(apiTokens)
		.set({ lastUsedAt: new Date() })
		.where(eq(apiTokens.id, apiToken.id));
	return { userId: apiToken.userId, tokenId: apiToken.id };
}

export function listApiTokens(db: Database, userId: string) {
	return db
		.select({
			id: apiTokens.id,
			name: apiTokens.name,
			tokenPrefix: apiTokens.tokenPrefix,
			lastUsedAt: apiTokens.lastUsedAt,
			expiresAt: apiTokens.expiresAt,
			revokedAt: apiTokens.revokedAt,
			createdAt: apiTokens.createdAt,
		})
		.from(apiTokens)
		.where(eq(apiTokens.userId, userId))
		.orderBy(desc(apiTokens.createdAt));
}

export async function createApiToken(db: Database, userId: string, name: string) {
	const token = `vrx_${randomBytes(24).toString("base64url")}`;
	const tokenPrefix = token.slice(0, 12);
	const [created] = await db
		.insert(apiTokens)
		.values({
			userId,
			name,
			tokenHash: hashToken(token),
			tokenPrefix,
		})
		.returning({
			id: apiTokens.id,
			name: apiTokens.name,
			tokenPrefix: apiTokens.tokenPrefix,
			lastUsedAt: apiTokens.lastUsedAt,
			expiresAt: apiTokens.expiresAt,
			revokedAt: apiTokens.revokedAt,
			createdAt: apiTokens.createdAt,
		});

	if (!created) {
		throw new Error("API token creation returned no row");
	}

	return { ...created, token };
}

export async function revokeApiToken(
	db: Database,
	userId: string,
	tokenId: string,
	revokedAt = new Date(),
) {
	const [revoked] = await db
		.update(apiTokens)
		.set({ revokedAt })
		.where(
			and(
				eq(apiTokens.id, tokenId),
				eq(apiTokens.userId, userId),
				isNull(apiTokens.revokedAt),
			),
		)
		.returning({ id: apiTokens.id });

	if (!revoked) throw new NotFoundError("API token");
}
